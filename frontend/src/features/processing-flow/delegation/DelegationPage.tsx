/**
 * /uy-quyen-xu-ly — "Uỷ quyền xử lý": a person who will be away lets a colleague of their unit act for them on the
 * steps of the processing flow, for a range of days. Two lists (what I gave, what I received), a panel to create one,
 * and "Thu hồi" with a confirmation in the row. A delegation is never edited: it is revoked and made anew.
 */
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRightLeft, ShieldOff } from 'lucide-react';
import { A11Y_FOCUS_RING, BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { formatVNDate, today } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { FeatureOffState } from '../components/FeatureOffState';
import { explainError, isFeatureOff } from '../errors';
import { DELEGATION_QUERY_KEYS, delegationApi, type DelegationDto, type DelegationState } from './api';

const D = L.delegation;

const FIELD = `rounded border border-slate-300 bg-white px-3 py-2 text-sm ${A11Y_FOCUS_RING}`;
const LABEL = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600';

const STATE_CLASS: Record<DelegationState, string> = {
  IN_FORCE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  UPCOMING: 'border-blue-200 bg-blue-50 text-blue-800',
  ENDED: 'border-slate-200 bg-slate-50 text-slate-600',
  REVOKED: 'border-red-200 bg-red-50 text-red-700',
};

function Row({ row, side, confirming, busy, onAsk, onCancel, onRevoke }: {
  row: DelegationDto;
  side: 'given' | 'received';
  confirming: boolean;
  busy: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onRevoke: () => void;
}) {
  const name = (side === 'given' ? row.toName : row.fromName) ?? D.unknownPerson;
  return (
    <li data-testid={`delegation-${row.id}`} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{side === 'given' ? D.to(name) : D.from(name)}</span>
        <span className="text-sm tabular-nums text-slate-700">{D.range(formatVNDate(row.validFrom), formatVNDate(row.validTo))}</span>
        <span data-testid={`delegation-${row.id}-state`} className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STATE_CLASS[row.state] ?? STATE_CLASS.ENDED}`}>
          {D.states[row.state] ?? row.state}
        </span>
        {row.canRevoke && !confirming && (
          <button type="button" data-testid={`delegation-${row.id}-revoke`} className={`text-sm text-red-700 hover:underline ${A11Y_FOCUS_RING}`} onClick={onAsk}>
            {D.revoke}
          </button>
        )}
      </div>
      {row.note && <p className="mt-1 text-xs text-slate-500">{row.note}</p>}
      {confirming && (
        <div data-testid={`delegation-${row.id}-confirm`} role="group" className="mt-2 flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm text-red-800">{D.revokeConfirm(name)}</p>
          <button type="button" data-testid={`delegation-${row.id}-revoke-yes`} className={BTN_DANGER} disabled={busy} onClick={onRevoke}>
            {busy ? D.revoking : D.revokeYes}
          </button>
          <button type="button" data-testid={`delegation-${row.id}-revoke-no`} className={BTN_SECONDARY} disabled={busy} onClick={onCancel}>
            {L.common.cancel}
          </button>
        </div>
      )}
    </li>
  );
}

export default function DelegationPage() {
  const client = useQueryClient();
  const mineQ = useQuery({ queryKey: DELEGATION_QUERY_KEYS.mine, queryFn: delegationApi.mine, retry: false });
  const candidatesQ = useQuery({ queryKey: DELEGATION_QUERY_KEYS.candidates, queryFn: delegationApi.candidates, retry: false });

  const [toUserId, setToUserId] = useState('');
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const refresh = () => client.invalidateQueries({ queryKey: DELEGATION_QUERY_KEYS.mine });

  const createM = useMutation({
    mutationFn: delegationApi.create,
    onSuccess: async () => {
      setToUserId('');
      setValidTo('');
      setNote('');
      setFormError(null);
      await refresh();
    },
    onError: (error: unknown) => setFormError(explainError(error).message || L.common.unknownError),
  });

  const revokeM = useMutation({
    mutationFn: delegationApi.revoke,
    onSuccess: async () => {
      setConfirming(null);
      setRevokeError(null);
      await refresh();
    },
    onError: async (error: unknown) => {
      setRevokeError(explainError(error).message || L.common.unknownError);
      // Somebody else may have revoked it meanwhile: the list says what is true now.
      await refresh();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!toUserId || !validFrom || !validTo) {
      setFormError(D.create.incomplete);
      return;
    }
    setFormError(null);
    const text = note.trim();
    createM.mutate({ toUserId, validFrom, validTo, ...(text ? { note: text } : {}) });
  };

  if (mineQ.isError && isFeatureOff(mineQ.error)) return <FeatureOffState body={L.recordTabs.off} />;

  const loadError = mineQ.isError ? explainError(mineQ.error) : null;
  const candidates = candidatesQ.data ?? [];

  const list = (side: 'given' | 'received', rows: DelegationDto[]) => (
    <section data-testid={`delegation-list-${side}`} className="rounded-lg border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">{side === 'given' ? D.given : D.received}</h2>
      {rows.length === 0 ? (
        <p data-testid={`delegation-empty-${side}`} className="px-4 py-6 text-center text-sm text-slate-500">
          {side === 'given' ? D.emptyGiven : D.emptyReceived}
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              side={side}
              confirming={confirming === row.id}
              busy={revokeM.isPending}
              onAsk={() => {
                setRevokeError(null);
                setConfirming(row.id);
              }}
              onCancel={() => setConfirming(null)}
              onRevoke={() => revokeM.mutate(row.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div data-testid="processing-delegation-page" className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-start gap-3">
        <ArrowRightLeft className="mt-1 h-6 w-6 flex-shrink-0 text-blue-700" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">{D.title}</h1>
          <p className="text-sm text-slate-600">{D.subtitle}</p>
        </div>
      </header>

      {loadError?.status === 403 ? (
        <div data-testid="delegation-forbidden" role="alert" className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <ShieldOff className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
          <p className="flex-1 text-sm text-amber-900">{D.forbidden}</p>
        </div>
      ) : loadError ? (
        <div data-testid="delegation-load-error" role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-red-700">{loadError.message || L.common.loadFailed}</p>
          <button type="button" data-testid="delegation-retry" className={BTN_SECONDARY} onClick={() => void mineQ.refetch()}>
            {L.common.retry}
          </button>
        </div>
      ) : mineQ.data === undefined ? (
        <p data-testid="delegation-loading" role="status" className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {L.common.loading}
        </p>
      ) : (
        <>
          <form data-testid="delegation-create" onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{D.create.title}</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className={`${LABEL} flex-1`}>
                {D.create.person}
                <select data-testid="delegation-person" className={FIELD} value={toUserId} onChange={(e) => setToUserId(e.target.value)} disabled={candidatesQ.isError}>
                  <option value="">{D.create.choosePerson}</option>
                  {candidates.map((person) => (
                    <option key={person.userId} value={person.userId}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                {D.create.from}
                <input data-testid="delegation-from" type="date" className={FIELD} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </label>
              <label className={LABEL}>
                {D.create.to}
                <input data-testid="delegation-to" type="date" className={FIELD} value={validTo} min={validFrom || undefined} onChange={(e) => setValidTo(e.target.value)} />
              </label>
              <label className={`${LABEL} w-full`}>
                {D.create.note}
                <input data-testid="delegation-note" type="text" maxLength={500} className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            {candidatesQ.isError ? (
              <p data-testid="delegation-candidates-error" role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700">
                {D.create.candidatesFailed}
                <button type="button" data-testid="delegation-candidates-retry" className={`underline ${A11Y_FOCUS_RING}`} onClick={() => void candidatesQ.refetch()}>
                  {L.common.retry}
                </button>
              </p>
            ) : (
              candidatesQ.data !== undefined && candidates.length === 0 && (
                <p data-testid="delegation-no-candidates" className="mt-2 text-sm text-slate-500">
                  {D.create.noCandidates}
                </p>
              )
            )}
            {formError && (
              <p data-testid="delegation-form-error" role="alert" className="mt-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="submit" data-testid="delegation-submit" className={BTN_PRIMARY} disabled={createM.isPending}>
                {createM.isPending ? D.create.submitting : D.create.submit}
              </button>
              <span className="text-xs text-slate-500">{D.create.hint}</span>
            </div>
          </form>

          {revokeError && (
            <p data-testid="delegation-revoke-error" role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {revokeError}
            </p>
          )}
          {list('given', mineQ.data.given)}
          {list('received', mineQ.data.received)}
        </>
      )}
    </div>
  );
}
