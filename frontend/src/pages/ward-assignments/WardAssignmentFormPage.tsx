/**
 * /ho-so-phan-cong/new · /ho-so-phan-cong/:id (read) · /ho-so-phan-cong/:id/edit — one request on one page, three blocks:
 *   1. "Thông tin trình" — written by the ward unit (or by PC02 on its behalf), read-only once submitted;
 *   2. "Thẩm định của PC02" — the review (requirements, return or approve, and their reverse actions);
 *   3. "Sau duyệt và kết quả" — received back, result deadline (extend), result, completion (reopen).
 * Blocks 2 and 3 show once the request has been submitted; the ward unit reads them. What a button may do is the
 * server's answer (`can`), so the page offers exactly what the server would accept. Every write carries the stamp the
 * page read; a 409 offers to load the request again.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { CheDoXemProvider, useCheDoXem } from '@/components/form/CheDoXem';
import { CrimeSelect } from '@/components/CrimeSelect';
import { FormActionBar } from '@/components/shared/FormActionBar';
import { ConfirmModal, Modal } from '@/components/shared/Modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE, LABEL_BASE, LABEL_REQUIRED_MARKER, SELECT_BASE, TEXTAREA_BASE } from '@/constants/styles';
import { useFormShortcuts } from '@/hooks/useFormShortcuts';
import { useCrimeOptions } from '@/hooks/useCrimeOptions';
import { formatVNDate } from '@/lib/dates';
import { authStore } from '@/stores/auth.store';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentsApi, WARD_QUERY_KEYS } from '@/features/ward-assignments/api';
import { explainWardError } from '@/features/ward-assignments/errors';
import { WARD_PATHS } from '@/features/ward-assignments/menu';
import {
  badBirthYearRows,
  displayStatus,
  emptyForm,
  formFromDetail,
  investigatorLabel,
  toPayload,
  type WardFormState,
} from '@/features/ward-assignments/formModel';
import type { WardAssignmentDetail, WardCaseType, WardKind } from '@/features/ward-assignments/types';
import { WardStatusBadge } from '@/features/ward-assignments/components/WardStatusBadge';
import { SubjectsTable } from '@/features/ward-assignments/components/SubjectsTable';
import { ReviewBlock, type RunAction } from '@/features/ward-assignments/components/ReviewBlock';
import { FollowUpBlock } from '@/features/ward-assignments/components/FollowUpBlock';
import { RoundHistory, type DescribeValue } from '@/features/ward-assignments/components/RoundHistory';
import { InvestigatorDirectoryDialog } from '@/features/ward-assignments/components/InvestigatorDirectoryDialog';
import { useApprovedOfUnit, useUnitInvestigators, useWardUnits } from '@/features/ward-assignments/useWardChoices';
import { SubjectMatches } from '@/features/ward-assignments/components/SubjectMatches';

const F = L.form.fields;
const A = L.form.actions;

type Banner = { kind: 'error' | 'conflict' | 'ok'; text: string; missing?: string[] } | null;

function bannerOf(err: unknown): Banner {
  const e = explainWardError(err);
  return { kind: e.conflict ? 'conflict' : 'error', text: e.conflict ? L.form.changed.text : e.message, missing: e.missing };
}

interface SignedIn {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
  phone?: string | null;
  isWardOfficer?: boolean;
  wardTeam?: { id: string; name: string } | null;
  teams?: { teamId: string; teamName: string }[];
}

function Labelled({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={LABEL_BASE}>
        {label}
        {required && <span className={LABEL_REQUIRED_MARKER}> *</span>}
        {hint && <span className="ml-1 font-normal text-slate-500">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

/** A segmented choice of two or more values (radios), locked in read mode. */
function Segmented<T extends string>({ name, value, options, onChange, testId }: { name: string; value: T; options: Record<T, string>; onChange: (v: T) => void; testId: string }) {
  const readOnly = useCheDoXem();
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex overflow-hidden rounded-lg border border-slate-300">
      {(Object.keys(options) as T[]).map((k) => (
        <label key={k} className={`cursor-pointer px-4 py-2 text-sm ${value === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'} ${readOnly ? 'cursor-default' : ''}`}>
          <input type="radio" className="sr-only" name={name} data-testid={`${testId}-${k}`} checked={value === k} disabled={readOnly} onChange={() => onChange(k)} />
          {options[k]}
        </label>
      ))}
    </div>
  );
}

function BannerView({ banner, onReload }: { banner: Banner; onReload: () => void }) {
  if (!banner) return null;
  const tone =
    banner.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : banner.kind === 'conflict' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-700';
  const Icon = banner.kind === 'ok' ? CheckCircle : banner.kind === 'conflict' ? AlertTriangle : AlertCircle;
  return (
    <div data-testid="ward-banner" role={banner.kind === 'ok' ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${tone}`}>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {banner.kind === 'conflict' && <p className="font-semibold">{L.form.changed.title}</p>}
        <p>{banner.text}</p>
        {banner.missing && banner.missing.length > 0 && (
          <>
            <p className="mt-1">{L.form.missing}</p>
            <ul className="list-disc pl-5">
              {banner.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      {banner.kind === 'conflict' && (
        <button type="button" className={BTN_SECONDARY} onClick={onReload}>
          {L.form.changed.reload}
        </button>
      )}
    </div>
  );
}

interface FormProps {
  detail: WardAssignmentDetail | null;
  mode: 'view' | 'edit';
  user: SignedIn | null;
  reload: () => void;
  /** Kept by the page: the form starts again on every new stamp, and the outcome of an action must survive it. */
  banner: Banner;
  setBanner: (b: Banner) => void;
}

function WardAssignmentForm({ detail, mode, user, reload, banner, setBanner }: FormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !detail;
  const can = detail?.can;
  const wardOfficer = !!user?.isWardOfficer && !!user.wardTeam;
  const editing = mode === 'edit' && (isNew || !!can?.edit);
  const [form, setForm] = useState<WardFormState>(() => (detail ? formFromDetail(detail) : emptyForm(user)));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'withdraw' | 'delete' | 'archive' | 'restore'>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const teamId = detail?.assignedTeamId ?? (wardOfficer ? user!.wardTeam!.id : form.assignedTeamId);
  const units = useWardUnits(isNew && !wardOfficer);
  const investigatorsQ = useUnitInvestigators(teamId);
  const investigators = useMemo(() => investigatorsQ.data ?? [], [investigatorsQ.data]);
  const approvedQ = useApprovedOfUnit(teamId, editing && form.kind === 'REASSIGN');
  const crimes = useCrimeOptions();
  const set = <K extends keyof WardFormState>(key: K, value: WardFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const afterChange = useCallback(() => qc.invalidateQueries({ queryKey: WARD_QUERY_KEYS.all }), [qc]);

  const fail = (err: unknown) => setBanner(bannerOf(err));

  // One write at a time: a second click or F2 while one runs would send it again with the same, soon stale, stamp
  // (or create a second draft). A ref, not the `busy` state: two events in one frame both see the old state.
  const inFlight = useRef(false);
  const exclusive = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const run: RunAction = async (fn, done) =>
    (await exclusive(async () => {
      setBanner(null);
      try {
        await fn();
        await afterChange();
        if (done) setBanner({ kind: 'ok', text: done });
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    })) ?? false;

  /** Saves block 1 (create or update) and answers the stored record; null when refused (the banner says why). */
  const save = async (): Promise<{ id: string; updatedAt: string } | null> => {
    const bad = badBirthYearRows(form);
    if (bad.length > 0) {
      setBanner({ kind: 'error', text: L.errors.WARD_SUBJECT_BIRTH_YEAR_INVALID });
      return null;
    }
    const payload = toPayload(form);
    try {
      if (isNew) return await wardAssignmentsApi.create({ ...payload, ...(wardOfficer ? {} : { assignedTeamId: form.assignedTeamId || null }) });
      return await wardAssignmentsApi.update(detail.id, payload, detail.updatedAt);
    } catch (err) {
      fail(err);
      return null;
    }
  };

  const onSaveDraft = () =>
    exclusive(async () => {
      setBanner(null);
      const saved = await save();
      if (!saved) return;
      await afterChange();
      navigate(WARD_PATHS.view(saved.id), { replace: isNew });
    });

  const onSubmit = () =>
    exclusive(async () => {
      setBanner(null);
      const target = editing ? await save() : detail ? { id: detail.id, updatedAt: detail.updatedAt } : null;
      if (!target) return;
      try {
        await wardAssignmentsApi.submit(target.id, target.updatedAt);
      } catch (err) {
        const why = bannerOf(err);
        await afterChange();
        // The draft was saved: from here on it is the stored request that is shown and corrected, still saying why.
        if (isNew) navigate(WARD_PATHS.edit(target.id), { replace: true, state: { banner: why } });
        else setBanner(why);
        return;
      }
      await afterChange();
      if (editing || isNew) navigate(WARD_PATHS.view(target.id), { replace: isNew });
      else setBanner({ kind: 'ok', text: L.form.submitted });
    });

  const confirmed = async () => {
    if (!detail || !confirm) return;
    const which = confirm;
    setConfirm(null);
    const stamp = detail.updatedAt;
    if (which === 'withdraw') await run(() => wardAssignmentsApi.withdraw(detail.id, stamp));
    if (which === 'archive') await run(() => wardAssignmentsApi.archive(detail.id, stamp));
    if (which === 'restore') await run(() => wardAssignmentsApi.restore(detail.id, stamp));
    if (which === 'delete' && (await run(() => wardAssignmentsApi.remove(detail.id, stamp)))) navigate(WARD_PATHS.list);
  };

  const goList = () => navigate(WARD_PATHS.list);
  const submittable = isNew || !!can?.submit;
  useFormShortcuts({
    onSave: editing ? () => void onSaveDraft() : undefined,
    onCancel: goList,
    onDelete: () => setConfirm('delete'),
    canDelete: !!can?.delete,
  });

  const describe: DescribeValue = (field, value) => {
    if (field === 'crimeId') return (crimes.data ?? []).find((c) => c.id === value)?.name ?? null;
    if (field === 'proposedInvestigatorId') return investigatorLabel(investigators.find((i) => i.id === value)) || null;
    return null;
  };

  const resubmit = (detail?.submissionCount ?? 0) > 0;
  const submitted = !!detail && detail.rounds.length > 0;
  const status = detail ? displayStatus(detail) : 'DRAFT';
  const returned = detail?.status === 'RETURNED';
  const lastReturn = returned ? [...detail.rounds].sort((a, b) => b.sequence - a.sequence)[0]?.decisions.filter((d) => !d.revokedAt).at(-1) : null;
  const activeInvestigators = investigators.filter((i) => i.isActive || i.id === form.proposedInvestigatorId);
  const defaultFollowUpTeamId = user?.teams?.find((t) => t.teamId !== user.wardTeam?.id)?.teamId ?? null;

  const actions = (
    <>
      {editing && (
        <button type="button" data-testid="ward-save-draft" className={BTN_SECONDARY} disabled={busy} onClick={() => void onSaveDraft()}>
          {busy ? A.saving : isNew || detail?.status === 'DRAFT' ? A.saveDraft : A.save}
        </button>
      )}
      {submittable && (
        <button type="button" data-testid="ward-submit" className={BTN_PRIMARY} disabled={busy} onClick={() => void onSubmit()}>
          {resubmit ? A.resubmit : A.submit}
        </button>
      )}
      {can?.withdraw && (
        <button type="button" data-testid="ward-withdraw" className={BTN_SECONDARY} disabled={busy} onClick={() => setConfirm('withdraw')}>
          {A.withdraw}
        </button>
      )}
      {can?.archive && (
        <button type="button" data-testid="ward-archive" className={BTN_SECONDARY} disabled={busy} onClick={() => setConfirm('archive')}>
          {A.archive}
        </button>
      )}
      {can?.restore && (
        <button type="button" data-testid="ward-restore" className={BTN_SECONDARY} disabled={busy} onClick={() => setConfirm('restore')}>
          {A.restore}
        </button>
      )}
      {can?.delete && (
        <button type="button" data-testid="ward-delete" className={BTN_DANGER} disabled={busy} onClick={() => setConfirm('delete')}>
          {A.delete}
        </button>
      )}
      {can?.deleteWithData && (
        <button type="button" data-testid="ward-delete-with-data" className={BTN_DANGER} disabled={busy} onClick={() => setPurgeOpen(true)}>
          {A.deleteWithData}
        </button>
      )}
    </>
  );

  return (
    <div data-testid="ward-assignment-form-page" className="space-y-4 p-4 sm:p-6">
      <FormActionBar
        title={isNew ? L.form.titleNew : L.form.titleView(detail.code)}
        subtitle={[detail?.code ? null : L.form.codeLater, L.form.submissionCount(detail?.submissionCount ?? 0)].filter(Boolean).join(' · ')}
        onBack={goList}
        onCancel={goList}
        editAction={mode === 'view' && can?.edit ? { label: A.edit, testId: 'ward-edit', onClick: () => navigate(WARD_PATHS.edit(detail!.id)) } : undefined}
        saveAction={actions}
      />
      <div className="flex flex-wrap items-center gap-2">
        <WardStatusBadge status={status} testId="ward-status" />
        {detail?.submittedAt && (
          <span className="text-sm text-slate-600">
            {F.submittedAt}: {formatVNDate(detail.submittedAt)}
          </span>
        )}
      </div>

      <BannerView banner={banner} onReload={reload} />
      {detail?.archivedAt && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{L.form.archivedBanner}</p>}
      {returned && (
        <div data-testid="ward-returned-banner" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{L.form.returnedBanner}</p>
          {lastReturn && (
            <>
              {(lastReturn.reasonText || lastReturn.reasonCode) && (
                <p className="mt-1">
                  <span className="font-semibold">{L.review.returnReason}: </span>
                  {[lastReturn.reasonCode, lastReturn.reasonText].filter(Boolean).join(' · ')}
                </p>
              )}
              {(lastReturn.requirements ?? []).length > 0 && (
                <ol className="mt-1 list-decimal pl-6">
                  {(lastReturn.requirements ?? []).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}

      <CheDoXemProvider xem={!editing}>
        <section data-testid="ward-block-content" aria-labelledby="ward-block-content-title" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="ward-block-content-title" className="text-base font-semibold text-slate-800">
            {L.form.block1}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className={LABEL_BASE}>
                {F.unit}
                <span className={LABEL_REQUIRED_MARKER}> *</span>
              </span>
              {isNew && !wardOfficer ? (
                <select data-testid="ward-unit" aria-label={F.unit} className={SELECT_BASE} value={form.assignedTeamId} onChange={(e) => setForm((f) => ({ ...f, assignedTeamId: e.target.value, proposedInvestigatorId: '', previousAssignmentId: '' }))}>
                  <option value="">{F.unitPick}</option>
                  {units.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p data-testid="ward-unit-fixed" className="py-2.5 text-sm font-medium text-slate-800">
                  {detail?.assignedTeam?.name ?? user?.wardTeam?.name ?? ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <span className={LABEL_BASE}>
                  {F.caseType}
                  <span className={LABEL_REQUIRED_MARKER}> *</span>
                </span>
                <Segmented<WardCaseType> name={F.caseType} testId="ward-case-type" value={form.caseType} options={L.caseType} onChange={(v) => set('caseType', v)} />
              </div>
              <div>
                <span className={LABEL_BASE}>
                  {F.kind}
                  <span className={LABEL_REQUIRED_MARKER}> *</span>
                </span>
                <Segmented<WardKind> name={F.kind} testId="ward-kind" value={form.kind} options={L.kind} onChange={(v) => set('kind', v)} />
              </div>
            </div>

            {form.kind === 'REASSIGN' && (
              <>
                <Labelled label={F.previous} required>
                  <select data-testid="ward-previous" className={SELECT_BASE} disabled={!editing} value={form.previousAssignmentId} onChange={(e) => set('previousAssignmentId', e.target.value)}>
                    <option value="">{F.previousPick}</option>
                    {form.previousAssignmentId && !(approvedQ.data ?? []).some((r) => r.id === form.previousAssignmentId) && (
                      <option value={form.previousAssignmentId}>{form.previousAssignmentId}</option>
                    )}
                    {(approvedQ.data ?? [])
                      .filter((r) => r.id !== detail?.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} · {r.summary}
                        </option>
                      ))}
                  </select>
                  {editing && approvedQ.isSuccess && approvedQ.data.length === 0 && <span className="mt-1 block text-xs text-slate-500">{F.previousNone}</span>}
                </Labelled>
                <Labelled label={F.reassignReason} required>
                  <textarea data-testid="ward-reassign-reason" rows={2} className={TEXTAREA_BASE} readOnly={!editing} value={form.reassignReason} onChange={(e) => set('reassignReason', e.target.value)} />
                </Labelled>
              </>
            )}

            <CrimeSelect label={F.crime} required value={form.crimeId} onChange={(v) => set('crimeId', v)} testId="ward-crime" />
            <Labelled label={F.crimeOther}>
              <input data-testid="ward-crime-other" className={INPUT_BASE} readOnly={!editing} value={form.crimeOther} onChange={(e) => set('crimeOther', e.target.value)} />
            </Labelled>
            <div className="md:col-span-2">
              <Labelled label={F.summary} required hint={F.summaryHint}>
                <input data-testid="ward-summary" className={INPUT_BASE} readOnly={!editing} maxLength={500} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
              </Labelled>
            </div>
            <div className="md:col-span-2">
              <Labelled label={F.content} required>
                <textarea data-testid="ward-content" rows={5} className={TEXTAREA_BASE} readOnly={!editing} value={form.content} onChange={(e) => set('content', e.target.value)} />
              </Labelled>
            </div>
            <Labelled label={F.discoveredOn}>
              <input type="date" data-testid="ward-discovered-on" className={`${INPUT_BASE} max-w-[12rem]`} readOnly={!editing} value={form.discoveredOn} onChange={(e) => set('discoveredOn', e.target.value)} />
            </Labelled>
            <Labelled label={F.place}>
              <input data-testid="ward-place" className={INPUT_BASE} readOnly={!editing} value={form.place} onChange={(e) => set('place', e.target.value)} />
            </Labelled>
          </div>

          <div>
            <span className={LABEL_BASE}>
              {F.subjects}
              <span className={LABEL_REQUIRED_MARKER}> *</span>
            </span>
            <SubjectsTable
              rows={form.subjects}
              unknown={form.subjectsUnknown}
              badBirthYears={badBirthYearRows(form)}
              onRowsChange={(rows) => set('subjects', rows)}
              onUnknownChange={(v) => set('subjectsUnknown', v)}
            />
            {detail?.id && <SubjectMatches assignmentId={detail.id} canConclude={detail.can.review} />}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className={LABEL_BASE}>
                {F.proposedInvestigator}
                <span className={LABEL_REQUIRED_MARKER}> *</span>
              </span>
              <div className="flex gap-2">
                <select
                  data-testid="ward-proposed-investigator"
                  aria-label={F.proposedInvestigator}
                  className={SELECT_BASE}
                  disabled={!editing || !teamId}
                  value={form.proposedInvestigatorId}
                  onChange={(e) => set('proposedInvestigatorId', e.target.value)}
                >
                  <option value="">{F.investigatorPick}</option>
                  {activeInvestigators.map((i) => (
                    <option key={i.id} value={i.id}>
                      {investigatorLabel(i)}
                    </option>
                  ))}
                </select>
                {(editing || !!can?.review) && (
                  <button type="button" data-testid="ward-open-directory" className={BTN_SECONDARY} disabled={!teamId} title={L.investigators.open} onClick={() => setDirectoryOpen(true)}>
                    {L.investigators.open}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Labelled label={F.entryOfficerName} required>
                <input data-testid="ward-entry-officer" className={INPUT_BASE} readOnly={!editing} value={form.entryOfficerName} onChange={(e) => set('entryOfficerName', e.target.value)} />
              </Labelled>
              <Labelled label={F.entryOfficerPhone}>
                <input data-testid="ward-entry-phone" className={INPUT_BASE} readOnly={!editing} value={form.entryOfficerPhone} onChange={(e) => set('entryOfficerPhone', e.target.value)} />
              </Labelled>
            </div>
            <div className="md:col-span-2">
              <Labelled label={F.unitNote}>
                <textarea data-testid="ward-unit-note" rows={2} className={TEXTAREA_BASE} readOnly={!editing} value={form.unitNote} onChange={(e) => set('unitNote', e.target.value)} />
              </Labelled>
            </div>
          </div>
        </section>
      </CheDoXemProvider>

      {submitted && detail && (
        <>
          <ReviewBlock key={`review-${detail.updatedAt}`} detail={detail} investigators={investigators} defaultFollowUpTeamId={defaultFollowUpTeamId} run={run} busy={busy} />
          <FollowUpBlock key={`follow-${detail.updatedAt}`} detail={detail} run={run} busy={busy} />
        </>
      )}
      {detail && (
        <RoundHistory
          rounds={detail.rounds}
          describe={describe}
          slip={{ assignmentId: detail.id, canIssue: !!detail.can.issueSlip, onChanged: reload }}
        />
      )}

      <InvestigatorDirectoryDialog
        open={directoryOpen}
        teamId={teamId}
        onClose={() => setDirectoryOpen(false)}
        onCreated={(inv) => {
          if (editing) set('proposedInvestigatorId', inv.id);
        }}
      />
      <ConfirmModal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmed()}
        title={L.form.confirm.title}
        message={confirm ? L.form.confirm[confirm] : ''}
        confirmLabel={L.form.confirm.yes}
        cancelLabel={L.form.confirm.cancel}
        variant={confirm === 'delete' ? 'danger' : 'default'}
      />
      {detail && purgeOpen && <DeleteWithDataDialog detail={detail} onClose={() => setPurgeOpen(false)} onDone={goList} />}
    </div>
  );
}

/** Admin: delete the request with all its data. Says how many records go, and asks for the code typed again. */
function DeleteWithDataDialog({ detail, onClose, onDone }: { detail: WardAssignmentDetail; onClose: () => void; onDone: () => void }) {
  const D = L.form.deleteWithData;
  const qc = useQueryClient();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const impact = useQuery({ queryKey: ['ward-assignments', 'impact', detail.id], queryFn: () => wardAssignmentsApi.deletionImpact(detail.id), retry: false });
  const code = detail.code ?? '';
  const go = async () => {
    setBusy(true);
    try {
      await wardAssignmentsApi.removeWithData(detail.id, typed.trim(), detail.updatedAt);
      await qc.invalidateQueries({ queryKey: WARD_QUERY_KEYS.all });
      onDone();
    } catch (err) {
      setError(explainWardError(err).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={D.title}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {L.form.confirm.cancel}
          </button>
          <button type="button" data-testid="ward-purge-confirm" className={BTN_DANGER} disabled={busy || !impact.isSuccess || typed.trim() !== code} onClick={() => void go()}>
            {D.confirm}
          </button>
        </div>
      }
    >
      <div data-testid="ward-purge" className="space-y-3 text-sm">
        <p>{D.intro}</p>
        {impact.isLoading ? (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {D.counting}
          </p>
        ) : impact.data ? (
          <ul className="list-disc pl-5">
            {(Object.keys(D.lines) as (keyof typeof D.lines)[]).map((k) => (
              <li key={k}>{D.lines[k](impact.data[k] ?? 0)}</li>
            ))}
          </ul>
        ) : (
          impact.isError && <p className="text-red-700">{explainWardError(impact.error).message}</p>
        )}
        <label className="block">
          <span className={LABEL_BASE}>{D.typeCode(code)}</span>
          <input data-testid="ward-purge-code" className={INPUT_BASE} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default function WardAssignmentFormPage({ mode }: { mode: 'view' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const user = authStore.getUser() as SignedIn | null;
  const location = useLocation();
  // A banner handed over by the page that moved here (a new draft saved, its submission refused).
  const [banner, setBanner] = useState<Banner>(() => (location.state as { banner?: Banner } | null)?.banner ?? null);
  const detailQ = useQuery({
    queryKey: WARD_QUERY_KEYS.detail(id ?? ''),
    queryFn: () => wardAssignmentsApi.get(id!),
    enabled: !!id,
    retry: false,
    // Read fresh every time the page opens: its stamp and `can` are what every write is sent with. No refetch on
    // window focus: a new stamp starts the form again, and that must not happen under the person's typing.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  if (id && detailQ.isLoading) {
    return (
      <div data-testid="ward-form-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        {L.form.loading}
      </div>
    );
  }
  if (id && detailQ.isError) {
    const e = explainWardError(detailQ.error);
    return (
      <div data-testid="ward-form-error" role="alert" className="m-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1">{e.status === 404 ? L.form.notFound : L.form.loadFailed}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void detailQ.refetch()}>
          {L.list.retry}
        </button>
      </div>
    );
  }
  const detail = id ? (detailQ.data ?? null) : null;
  return (
    <WardAssignmentForm
      // A new stamp (after an action, or a reload after a conflict) starts the form again from what is stored.
      key={detail?.updatedAt ?? 'new'}
      detail={detail}
      mode={mode}
      user={user}
      banner={banner}
      setBanner={setBanner}
      reload={() => {
        setBanner(null);
        void detailQ.refetch();
      }}
    />
  );
}
