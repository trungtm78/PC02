/**
 * S11 — Lưới nhập liệu (spec §6.1 PR6). Scope decision (continues the
 * S04 precedent): ships as a FORM grouped by sheet — one labeled input
 * per field — not a pixel-faithful Excel grid. Every real template this
 * system parses (HSLN: 258 rows × 3 cols, label in col A, number in col
 * C) is structurally a label→value list; a grouped form is both simpler
 * to build correctly and, per S24's own requirement that mobile uses a
 * single-field editor anyway, arguably the more usable shape. GridRenderer
 * (a visual, merge-aware spreadsheet) stays deferred to when a consumer
 * that genuinely needs the 2-D spatial layout exists (e.g. S16 manager
 * review) — the same "build it once a real need is concrete" call made
 * for S04's candidate list instead of a grid.
 *
 * SUBMIT (S29) takes no value patch — any pending autosave is flushed
 * first, matching the spec's own "chờ autosave xong" requirement.
 * `hasErrorSeverityRuleViolation` is always false server-side (no
 * validation rule can exist yet — PR9), so the only guard that can
 * actually block a submit today is a missing required field.
 */
import { useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, Clock, Lock, Unlock, Send } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { DynReportSubmissionState, SubmissionFieldView, TypedValue } from '@/features/dynamic-reports/types';
import { planPaste } from '@/features/dynamic-reports/engine/generated/paste';
import { validateFieldValue } from '@/features/dynamic-reports/engine/generated/values';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

const EDITABLE_STATES: readonly DynReportSubmissionState[] = ['NOT_STARTED', 'DRAFT', 'RETURNED'];

const AUTOSAVE_IDLE_MS = 2000;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function SubmissionInputPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { data: initial, isLoading, isError, refetch } = useQuery({
    queryKey: ['dynamic-reports', 'submission', assignmentId],
    queryFn: () => dynamicReportsApi.getSubmission(assignmentId as string),
    enabled: !!assignmentId,
  });

  // Overrides only — never pre-seeded from `initial` via an effect
  // (React's own guidance: derive what can be derived during render
  // instead of copying query data into state). `values` holds only
  // fields the user has actually typed into; everything else falls back
  // to `initial.values` at render time. `revision`/`editable`/
  // `effectiveLockAt` are null until a save response overrides them —
  // until then the initial query's own fields are the effective value.
  const [values, setValues] = useState<Record<string, string>>({});
  const [revisionOverride, setRevisionOverride] = useState<string | null>(null);
  const [editableOverride, setEditableOverride] = useState<boolean | null>(null);
  const [lockAtOverride, setLockAtOverride] = useState<string | null>(null);
  const [stateOverride, setStateOverride] = useState<DynReportSubmissionState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'working' | 'sent' | 'error'>('idle');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [conflict, setConflict] = useState<{
    mineByKey: Record<string, string | null>;
    serverByKey: Record<string, TypedValue | undefined>;
    serverRevision: string;
    serverEffectiveLockAt: string | null;
  } | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // S26 — ties one idempotency key to one exact (patch, revision) pair, so a
  // network-error retry of the SAME attempt reuses it (never double-applies
  // a request that actually reached the server but whose response was
  // lost), while a genuinely different attempt always gets a fresh key.
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const revision = revisionOverride ?? initial?.revision ?? null;
  const editable = editableOverride ?? initial?.editable ?? true;
  const effectiveLockAt = lockAtOverride ?? initial?.effectiveLockAt ?? null;
  const state = stateOverride ?? initial?.state ?? 'NOT_STARTED';

  async function flush(current: Record<string, string>, revisionForThisCall?: string) {
    const effectiveRevision = revisionForThisCall ?? revision;
    if (!assignmentId || !effectiveRevision || dirtyRef.current.size === 0) return;
    const dirtyKeys = Array.from(dirtyRef.current);
    const patch: Record<string, string | null> = {};
    for (const key of dirtyKeys) {
      patch[key] = current[key]?.trim() ? current[key] : null;
    }
    const signature = JSON.stringify({ assignmentId, patch, revision: effectiveRevision });
    const idempotencyKey =
      idempotencyRef.current?.signature === signature
        ? idempotencyRef.current.key
        : crypto.randomUUID();
    idempotencyRef.current = { signature, key: idempotencyKey };

    dirtyRef.current = new Set();
    setSaveStatus('saving');
    setSaveError(null);
    setCanRetrySave(false);
    try {
      const result = await dynamicReportsApi.saveSubmissionValues(
        assignmentId,
        patch,
        effectiveRevision,
        idempotencyKey,
      );
      idempotencyRef.current = null;
      setRevisionOverride(result.revision);
      setLockAtOverride(result.effectiveLockAt);
      setSaveStatus('saved');
      setFieldErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(patch)) delete next[key];
        return next;
      });
    } catch (err) {
      const apiError = extractApiError(err);
      if (apiError.code === 'REVISION_CONFLICT') {
        // S26 — re-mark dirty so either conflict resolution can resend the same patch.
        for (const key of dirtyKeys) dirtyRef.current.add(key);
        await loadConflict(patch);
      } else if (apiError.status === 0) {
        // S26 — network/timeout: keep the patch pending and the idempotency
        // key pinned, so "Thử lại" resends the exact same request.
        for (const key of dirtyKeys) dirtyRef.current.add(key);
        setSaveError('Mất kết nối — thay đổi chưa được lưu.');
        setCanRetrySave(true);
      } else if (apiError.code === 'CELL_VALIDATION') {
        idempotencyRef.current = null;
        setSaveError(apiError.message);
        const m = /Ô "([^"]+)"/.exec(apiError.message);
        if (m) setFieldErrors((prev) => ({ ...prev, [m[1]]: apiError.message }));
      } else if (apiError.code === 'REPORT_LOCKED') {
        idempotencyRef.current = null;
        setEditableOverride(false);
        setSaveError('Thay đổi này chưa được lưu do hết hạn.');
      } else {
        idempotencyRef.current = null;
        setSaveError(apiError.message);
      }
      setSaveStatus('error');
    }
  }

  /** S26 — fetch the server's current values to show a side-by-side comparison for a 409. */
  async function loadConflict(mine: Record<string, string | null>) {
    if (!assignmentId) return;
    try {
      const server = await dynamicReportsApi.getSubmission(assignmentId);
      setConflict({
        mineByKey: mine,
        serverByKey: server.values,
        serverRevision: server.revision,
        serverEffectiveLockAt: server.effectiveLockAt,
      });
    } catch {
      setSaveError('Bản nộp đã được sửa ở một phiên khác — tải lại trang để lấy bản mới nhất.');
    }
  }

  /** S26 — keep my unsaved edits; retry the exact same patch against the server's new revision. */
  function resolveConflictKeepMine() {
    if (!conflict) return;
    idempotencyRef.current = null; // the retry targets a different revision — needs its own key.
    setRevisionOverride(conflict.serverRevision);
    const newRevision = conflict.serverRevision;
    setConflict(null);
    void flush(values, newRevision);
  }

  /** S26 — discard my unsaved edits for the conflicting fields; adopt the server's current values. */
  function resolveConflictUseServer() {
    if (!conflict) return;
    const keys = Object.keys(conflict.mineByKey);
    setValues((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
    for (const key of keys) dirtyRef.current.delete(key);
    idempotencyRef.current = null;
    setRevisionOverride(conflict.serverRevision);
    setLockAtOverride(conflict.serverEffectiveLockAt);
    setConflict(null);
    setSaveStatus('idle');
    setSaveError(null);
  }

  async function handleSubmit() {
    if (!assignmentId || !initial) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await flush(values);

    const blankOptional = initial.fields.filter(
      (f) => !f.required && !(values[f.fieldKey] ?? initial.values[f.fieldKey]?.v ?? '').trim(),
    );
    if (blankOptional.length > 0) {
      const ok = window.confirm(
        `${blankOptional.length} ô để trống sẽ tính là 0. Tiếp tục nộp?`,
      );
      if (!ok) return;
    } else if (!window.confirm('Nộp bản này? Sau khi nộp sẽ không sửa được nữa.')) {
      return;
    }

    const currentRevision = revisionOverride ?? initial.revision;
    setSubmitting(true);
    setSaveError(null);
    try {
      const result = await dynamicReportsApi.submitSubmission(assignmentId, currentRevision);
      setRevisionOverride(result.revision);
      setStateOverride(result.state);
      setEditableOverride(false);
      setLockAtOverride(result.effectiveLockAt);
    } catch (err) {
      const apiError = extractApiError(err);
      if (apiError.code === 'REVISION_CONFLICT') {
        setSaveError('Bản nộp đã được sửa ở một phiên khác — tải lại trang để lấy bản mới nhất.');
      } else if (apiError.code === 'REPORT_LOCKED') {
        setEditableOverride(false);
        setSaveError('Thay đổi này chưa được lưu do hết hạn.');
      } else {
        setSaveError(apiError.message);
      }
      setSaveStatus('error');
    } finally {
      setSubmitting(false);
    }
  }

  /** S34 — the editor-side half: ask the manager to reopen this locked assignment. */
  async function handleRequestUnlock() {
    if (!assignmentId) return;
    const reason = window.prompt('Lý do xin mở lại:');
    if (!reason || !reason.trim()) return;
    setRequestStatus('working');
    setRequestError(null);
    try {
      await dynamicReportsApi.requestUnlock(assignmentId, reason.trim());
      setRequestStatus('sent');
    } catch (err) {
      setRequestStatus('error');
      setRequestError(extractApiError(err).message);
    }
  }

  function scheduleAutosave(next: Record<string, string>) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(next), AUTOSAVE_IDLE_MS);
  }

  function handleChange(fieldKey: string, raw: string) {
    setValues((prev) => {
      const next = { ...prev, [fieldKey]: raw };
      dirtyRef.current.add(fieldKey);
      scheduleAutosave(next);
      return next;
    });
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void flush(values);
  }

  /**
   * TSV paste (S11/PR6 slice 5, FRD §6.1): a multi-cell block copied from
   * Excel maps positionally onto this sheet's fields, anchored at the
   * field the user pasted into. `planPaste` (engine/paste.ts) rejects the
   * whole block if any targeted address isn't one of this sheet's input
   * fields; this handler adds the second half of its documented contract
   * — per-cell type validation via values.ts — and rejects the whole
   * block on the first invalid cell too, so a paste is all-or-nothing.
   * Single-cell paste (no tab/newline) falls through to the browser's
   * default paste so normal typing-equivalent behavior is unaffected.
   */
  function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    sheetKey: string,
    anchorAddress: string,
    sheetFields: SubmissionFieldView[],
  ) {
    const tsv = e.clipboardData.getData('text/plain');
    if (!tsv.includes('\t') && !tsv.includes('\n')) return;
    e.preventDefault();
    if (!editable) return;

    const byAddress = new Map(sheetFields.map((f) => [f.address, f]));
    const plan = planPaste(anchorAddress, tsv, (address) => byAddress.has(address));
    if (!plan.ok) {
      setSaveStatus('error');
      setSaveError(plan.error.message);
      return;
    }

    const normalized: Record<string, string> = {};
    for (const cell of plan.cells) {
      const field = byAddress.get(cell.address) as SubmissionFieldView;
      const validation = validateFieldValue(
        {
          type: field.type,
          required: field.required,
          min: field.min ?? undefined,
          max: field.max ?? undefined,
          scale: field.scale ?? undefined,
          maxLength: field.maxLength ?? undefined,
        },
        cell.rawValue.trim() === '' ? null : cell.rawValue,
      );
      if (!validation.ok) {
        setSaveStatus('error');
        setSaveError(`Ô "${sheetKey}!${cell.address}": ${validation.error.message}`);
        return;
      }
      normalized[`${sheetKey}!${cell.address}`] = validation.value.v ?? '';
    }

    const next = { ...values, ...normalized };
    for (const key of Object.keys(normalized)) dirtyRef.current.add(key);
    setValues(next);
    setSaveError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    void flush(next);
  }

  const bySheet = useMemo(() => {
    const groups = new Map<string, typeof initial extends undefined ? never : NonNullable<typeof initial>['fields']>();
    for (const f of initial?.fields ?? []) {
      const list = groups.get(f.sheetKey) ?? [];
      list.push(f);
      groups.set(f.sheetKey, list);
    }
    return Array.from(groups.entries());
  }, [initial]);

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-slate-500">Đang tải…</div>;
  }
  if (isError || !initial) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được lượt giao này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="submission-input-page">
      <Link
        to="/bao-cao-dong/nhap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách lượt giao
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-1">{initial.reportName}</h1>
      <p className="text-sm text-slate-500 mb-4">
        Kỳ {initial.periodKey} ({initial.periodStart} → {initial.periodEnd}) · Hạn{' '}
        {formatVNDateTime(initial.dueAt)}
      </p>

      {!editable && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center justify-between gap-2"
          data-testid="locked-banner"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Đã khoá, không thể sửa thêm
              {effectiveLockAt ? ` lúc ${formatVNDateTime(effectiveLockAt)}` : ''}.
            </p>
          </div>
          {requestStatus === 'sent' ? (
            <span className="text-xs font-medium text-amber-700" data-testid="unlock-request-sent">
              Đã gửi yêu cầu, đang chờ quản lý duyệt
            </span>
          ) : (
            <button
              type="button"
              data-testid="btn-request-unlock"
              disabled={requestStatus === 'working'}
              onClick={() => void handleRequestUnlock()}
              className={`text-xs font-medium text-amber-800 underline hover:text-amber-900 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              Xin mở lại
            </button>
          )}
        </div>
      )}
      {requestError && (
        <p className="text-sm text-red-700 mb-3" data-testid="unlock-request-error">
          {requestError}
        </p>
      )}

      {/* S14 — effectiveLockAt sau hạn gốc (dueAt) nghĩa là đang ở trong một lượt
          mở lại (grant hoặc trả lại kèm returnDueAt); access.ts đã gộp cả hai
          nguồn vào effectiveLockAt nên chỉ cần so sánh một lần ở đây. */}
      {editable && effectiveLockAt && new Date(effectiveLockAt) > new Date(initial.dueAt) && (
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2"
          data-testid="reopened-banner"
        >
          <Unlock className="w-4 h-4 text-blue-700 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            Được nhập lại đến {formatVNDateTime(effectiveLockAt)} · Hạn gốc vẫn là{' '}
            {formatVNDateTime(initial.dueAt)}.
          </p>
        </div>
      )}

      <div
        className="flex items-center gap-2 text-xs text-slate-500 mb-4"
        data-testid="save-status"
      >
        {saveStatus === 'saving' && (
          <>
            <Clock className="w-3.5 h-3.5 animate-spin" /> Đang lưu…
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Đã lưu
          </>
        )}
      </div>

      {saveError && (
        <p className="text-sm text-red-700 mb-2" data-testid="save-error">
          {saveError}
        </p>
      )}

      {canRetrySave && (
        <button
          type="button"
          data-testid="btn-retry-save"
          onClick={() => void flush(values)}
          className={`mb-4 px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-800 ${A11Y_FOCUS_RING}`}
        >
          Thử lại
        </button>
      )}

      {conflict && (
        <div
          className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4"
          data-testid="conflict-dialog"
        >
          <p className="text-sm font-semibold text-amber-900 mb-2">
            Bản nộp đã được sửa ở một phiên khác. Chọn cách xử lý:
          </p>
          <ul className="text-xs text-amber-800 mb-3 space-y-1">
            {Object.keys(conflict.mineByKey).map((key) => {
              const field = initial?.fields.find((f) => f.fieldKey === key);
              const mine = conflict.mineByKey[key];
              const server = conflict.serverByKey[key]?.v ?? null;
              return (
                <li key={key} data-testid={`conflict-row-${key}`}>
                  <strong>{field?.label || key}:</strong> Của bạn:{' '}
                  {mine ?? '(trống)'} — Trên máy chủ: {server ?? '(trống)'}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="btn-conflict-keep-mine"
              onClick={resolveConflictKeepMine}
              className={`px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 ${A11Y_FOCUS_RING}`}
            >
              Giữ bản của tôi
            </button>
            <button
              type="button"
              data-testid="btn-conflict-use-server"
              onClick={resolveConflictUseServer}
              className={`px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 ${A11Y_FOCUS_RING}`}
            >
              Dùng bản trên máy chủ
            </button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()}>
        {bySheet.map(([sheetKey, fields]) => (
          <div key={sheetKey} className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">{sheetKey}</h2>
            <div className="space-y-3">
              {fields.map((f) => (
                <label key={f.fieldKey} className="block text-sm">
                  <span className="text-slate-700">
                    {f.label || f.fieldKey}
                    {f.required && <span className="text-red-500"> *</span>}
                  </span>
                  <input
                    type={f.type === 'DATE' ? 'date' : f.type === 'TIME' ? 'time' : 'text'}
                    inputMode={f.type === 'NUM' ? 'decimal' : undefined}
                    data-testid={`input-${f.fieldKey}`}
                    value={values[f.fieldKey] ?? initial.values[f.fieldKey]?.v ?? ''}
                    disabled={!editable}
                    onChange={(e) => handleChange(f.fieldKey, e.target.value)}
                    onBlur={handleBlur}
                    onPaste={(e) => handlePaste(e, sheetKey, f.address, fields)}
                    className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  {fieldErrors[f.fieldKey] && (
                    <span className="text-xs text-red-600 mt-1 block">
                      {fieldErrors[f.fieldKey]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </form>

      {saveStatus === 'error' && saveError?.includes('phiên khác') && (
        <button
          type="button"
          data-testid="btn-reload"
          onClick={() => void refetch()}
          className={`px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
        >
          Tải lại
        </button>
      )}

      {EDITABLE_STATES.includes(state) ? (
        <button
          type="button"
          data-testid="btn-submit"
          disabled={!editable || submitting}
          onClick={() => void handleSubmit()}
          className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Đang nộp…' : 'Nộp'}
        </button>
      ) : (
        <p className="text-sm text-green-700 flex items-center gap-1" data-testid="submitted-note">
          <CheckCircle2 className="w-4 h-4" />
          {state === 'APPROVED' ? 'Đã được duyệt.' : 'Đã nộp — không thể sửa thêm.'}
        </p>
      )}
    </div>
  );
}
