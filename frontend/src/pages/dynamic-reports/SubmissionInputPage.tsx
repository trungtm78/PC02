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
 * first, matching the spec's own "chờ autosave xong" requirement. Before
 * confirming, `GET .../validate` (S36, PR9 slice 1) previews rule
 * violations: an ERROR violation blocks "Nộp" outright (same as a missing
 * required field); a WARNING violation shows a confirm dialog, same shape
 * as the existing "N ô trống tính là 0" confirm — the server itself never
 * requires a confirmation flag back, since WARNING is a UX nicety, not a
 * security boundary (`submit()` only ever blocks on ERROR).
 */
import { useMemo, useRef, useState } from 'react';
import { randomUUID } from '@/lib/uuid';
import { createSaveQueue } from '@/features/dynamic-reports/saveQueue';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, Clock, Download, FileSpreadsheet, Lock, Unlock, Send } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type {
  DynReportSubmissionState,
  ImportPreviewResult,
  SubmissionFieldView,
  TypedValue,
} from '@/features/dynamic-reports/types';
import { planPaste } from '@/features/dynamic-reports/engine/generated/paste';
import { validateFieldValue } from '@/features/dynamic-reports/engine/generated/values';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import CommentsPanel from './CommentsPanel';

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
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'previewing' | 'applying' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [ruleErrors, setRuleErrors] = useState<string[]>([]);
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  // S26 — ties one idempotency key to one exact (patch, revision) pair, so a
  // network-error retry of the SAME attempt reuses it (never double-applies
  // a request that actually reached the server but whose response was
  // lost), while a genuinely different attempt always gets a fresh key.
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);
  // H0 — saves are serialised through one queue and always read the latest
  // *acknowledged* revision and typed values from refs, never from the
  // render-time closure (which is stale by the time a queued save runs).
  const [saveQueue] = useState(createSaveQueue);
  const valuesRef = useRef<Record<string, string>>({});
  const revisionRef = useRef<string | null>(null);
  if (revisionRef.current === null && initial) revisionRef.current = initial.revision;

  const revision = revisionOverride ?? initial?.revision ?? null;
  const editable = editableOverride ?? initial?.editable ?? true;
  const effectiveLockAt = lockAtOverride ?? initial?.effectiveLockAt ?? null;
  const state = stateOverride ?? initial?.state ?? 'NOT_STARTED';

  /** Adopt a server-acknowledged revision for both the UI and the save queue. */
  function acceptRevision(next: string) {
    revisionRef.current = next;
    setRevisionOverride(next);
  }

  /**
   * Saves everything that is dirty, one request at a time, and resolves
   * `true` only when nothing is left unsaved. `false` means a save failed or
   * is waiting on the user (conflict / validation) — callers such as "Nộp"
   * must stop, because the server's copy does not contain the typed values.
   */
  async function flushAll(): Promise<boolean> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ok = await saveQueue.enqueue(runSave);
      if (!ok) return false;
      if (dirtyRef.current.size === 0) return true;
    }
    return false;
  }

  async function runSave(): Promise<boolean> {
    const effectiveRevision = revisionRef.current;
    if (!assignmentId || !effectiveRevision) return true;
    if (dirtyRef.current.size === 0) return true;
    const current = valuesRef.current;
    const dirtyKeys = Array.from(dirtyRef.current);
    const patch: Record<string, string | null> = {};
    for (const key of dirtyKeys) {
      patch[key] = current[key]?.trim() ? current[key] : null;
    }
    const signature = JSON.stringify({ assignmentId, patch, revision: effectiveRevision });
    const idempotencyKey =
      idempotencyRef.current?.signature === signature
        ? idempotencyRef.current.key
        : randomUUID();
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
      acceptRevision(result.revision);
      setLockAtOverride(result.effectiveLockAt);
      setSaveStatus('saved');
      setFieldErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(patch)) delete next[key];
        return next;
      });
      return true;
    } catch (err) {
      const apiError = extractApiError(err);
      // H0 — a failed save never drops what the user typed: every key goes
      // back into the dirty set so the next save (retry, blur, idle timer or
      // "Nộp") resends it, and "Nộp" refuses to run while any key is dirty.
      for (const key of dirtyKeys) dirtyRef.current.add(key);
      if (apiError.code === 'REVISION_CONFLICT') {
        // S26 — either conflict resolution resends the same patch.
        await loadConflict(patch);
      } else if (apiError.status === 0 || (apiError.status ?? 0) >= 500) {
        // S26 — network/timeout/5xx: the request may have committed, so keep
        // the idempotency key pinned and let "Thử lại" resend it verbatim.
        setSaveError(
          apiError.status === 0
            ? 'Mất kết nối — thay đổi chưa được lưu.'
            : `Máy chủ gặp lỗi — thay đổi chưa được lưu. ${apiError.message}`,
        );
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
      return false;
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
    acceptRevision(conflict.serverRevision);
    setConflict(null);
    void flushAll();
  }

  /** S26 — discard my unsaved edits for the conflicting fields; adopt the server's current values. */
  function resolveConflictUseServer() {
    if (!conflict) return;
    const keys = Object.keys(conflict.mineByKey);
    const next = { ...valuesRef.current };
    for (const key of keys) delete next[key];
    valuesRef.current = next;
    setValues(next);
    for (const key of keys) dirtyRef.current.delete(key);
    idempotencyRef.current = null;
    acceptRevision(conflict.serverRevision);
    setLockAtOverride(conflict.serverEffectiveLockAt);
    setConflict(null);
    setSaveStatus('idle');
    setSaveError(null);
  }

  /** "Xuất bản của tổ" — always available, even read-only after the deadline; export reflects whatever is currently saved. */
  async function handleExportOwnSubmission() {
    if (!assignmentId) return;
    setIsExporting(true);
    try {
      await dynamicReportsApi.exportOwnSubmission(assignmentId);
    } finally {
      setIsExporting(false);
    }
  }

  /** S35 — no DB write yet: shows the diff and waits for explicit confirmation. */
  async function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (importFileInputRef.current) importFileInputRef.current.value = '';
    if (!file || !assignmentId) return;
    setImportStatus('previewing');
    setImportError(null);
    setImportPreview(null);
    try {
      const preview = await dynamicReportsApi.previewExcelImport(assignmentId, file);
      setImportPreview(preview);
      setImportStatus('idle');
    } catch (err) {
      setImportStatus('error');
      setImportError(extractApiError(err).message);
    }
  }

  async function handleApplyImport() {
    if (!importPreview || !assignmentId || !revision) return;
    setImportStatus('applying');
    setImportError(null);
    try {
      // Queued behind any in-flight save so it applies against the
      // acknowledged revision instead of racing it into a 409.
      const result = await saveQueue.enqueue(() =>
        dynamicReportsApi.applyExcelImport(
          assignmentId,
          importPreview.values,
          revisionRef.current ?? revision,
        ),
      );
      acceptRevision(result.revision);
      setStateOverride(result.state);
      setLockAtOverride(result.effectiveLockAt);
      // `initial.values` (the query cache) is stale until a refetch — keep
      // showing exactly what the server now has, the same way a normal
      // save's response never needs to touch `values` because the user's
      // own typed text already matches what got saved.
      const next = { ...valuesRef.current };
      for (const [key, raw] of Object.entries(importPreview.values)) {
        next[key] = raw ?? '';
      }
      valuesRef.current = next;
      setValues(next);
      for (const key of Object.keys(importPreview.values)) dirtyRef.current.delete(key);
      setImportPreview(null);
      setImportStatus('idle');
    } catch (err) {
      setImportStatus('error');
      setImportError(extractApiError(err).message);
    }
  }

  function handleCancelImport() {
    setImportPreview(null);
    setImportStatus('idle');
    setImportError(null);
  }

  async function handleSubmit() {
    if (!assignmentId || !initial) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    // H0 — inputs are disabled from here on, so nothing can be typed between
    // the final save and the submit request below.
    setSubmitting(true);
    try {
      // Wait for every pending save and stop if any of them failed: the
      // server's copy would be missing what the user sees on screen.
      const saved = await flushAll();
      if (!saved) return;

      setRuleErrors([]);
      try {
        const { errors, warnings } = await dynamicReportsApi.validateForSubmit(assignmentId);
        if (errors.length > 0) {
          setRuleErrors(errors.map((e) => `${e.name}: ${e.message}`));
          return;
        }
        if (warnings.length > 0) {
          const ok = window.confirm(
            `${warnings.length} cảnh báo: ${warnings.map((w) => w.message).join('; ')}\n\nTiếp tục nộp?`,
          );
          if (!ok) return;
        }
      } catch (err) {
        setSaveError(extractApiError(err).message);
        return;
      }

      const blankOptional = initial.fields.filter(
        (f) =>
          !f.required &&
          !(valuesRef.current[f.fieldKey] ?? initial.values[f.fieldKey]?.v ?? '').trim(),
      );
      if (blankOptional.length > 0) {
        const ok = window.confirm(
          `${blankOptional.length} ô để trống sẽ tính là 0. Tiếp tục nộp?`,
        );
        if (!ok) return;
      } else if (!window.confirm('Nộp bản này? Sau khi nộp sẽ không sửa được nữa.')) {
        return;
      }

      const currentRevision = revisionRef.current ?? initial.revision;
      setSaveError(null);
      await submitAtRevision(assignmentId, currentRevision);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAtRevision(targetAssignmentId: string, currentRevision: string) {
    try {
      const result = await saveQueue.enqueue(() =>
        dynamicReportsApi.submitSubmission(targetAssignmentId, currentRevision),
      );
      acceptRevision(result.revision);
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
      } else if (apiError.code === 'VALIDATION_RULE_FAILED') {
        setRuleErrors([apiError.message]);
      } else {
        setSaveError(apiError.message);
      }
      setSaveStatus('error');
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

  function scheduleAutosave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushAll(), AUTOSAVE_IDLE_MS);
  }

  function handleChange(fieldKey: string, raw: string) {
    const next = { ...valuesRef.current, [fieldKey]: raw };
    valuesRef.current = next;
    setValues(next);
    dirtyRef.current.add(fieldKey);
    scheduleAutosave();
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void flushAll();
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

    const next = { ...valuesRef.current, ...normalized };
    valuesRef.current = next;
    for (const key of Object.keys(normalized)) dirtyRef.current.add(key);
    setValues(next);
    setSaveError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    void flushAll();
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

      <div className="flex items-center justify-between gap-2 mb-4">
        <div
          className="flex items-center gap-2 text-xs text-slate-500"
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-export-own-submission"
            disabled={isExporting}
            onClick={() => void handleExportOwnSubmission()}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
          {editable && (
            <>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx"
                data-testid="import-excel-input"
                className="hidden"
                onChange={(e) => void handleImportFileSelected(e)}
              />
              <button
                type="button"
                data-testid="btn-import-excel"
                disabled={importStatus === 'previewing'}
                onClick={() => importFileInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {importStatus === 'previewing' ? 'Đang đọc file…' : 'Nhập từ Excel'}
              </button>
            </>
          )}
        </div>
      </div>

      {importError && (
        <p className="text-sm text-red-700 mb-3" data-testid="import-error">
          {importError}
        </p>
      )}

      {importPreview && (
        <div
          className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4"
          data-testid="import-preview"
        >
          {importPreview.diff.length === 0 ? (
            <p className="text-sm text-blue-800 mb-3">
              File không có ô nào khác với bản hiện tại.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-blue-900 mb-2">
                {importPreview.diff.length} ô sẽ thay đổi:
              </p>
              <ul className="text-xs text-blue-800 mb-3 space-y-1">
                {importPreview.diff.map((d) => (
                  <li key={d.fieldKey} data-testid={`import-diff-row-${d.fieldKey}`}>
                    <strong>{d.label}:</strong> {d.current ?? '(trống)'} → {d.imported ?? '(trống)'}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="btn-import-apply"
              disabled={importStatus === 'applying' || importPreview.diff.length === 0}
              onClick={() => void handleApplyImport()}
              className={`px-3 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              {importStatus === 'applying' ? 'Đang áp dụng…' : 'Áp dụng'}
            </button>
            <button
              type="button"
              data-testid="btn-import-cancel"
              onClick={handleCancelImport}
              className={`px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 ${A11Y_FOCUS_RING}`}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-700 mb-2" data-testid="save-error">
          {saveError}
        </p>
      )}

      {canRetrySave && (
        <button
          type="button"
          data-testid="btn-retry-save"
          onClick={() => void flushAll()}
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
                    disabled={!editable || submitting}
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

      {ruleErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3" data-testid="rule-errors">
          <p className="text-sm font-medium text-red-800 mb-1">Chưa thể nộp — còn vi phạm quy tắc kiểm tra:</p>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {ruleErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
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

      {assignmentId && (
        <div className="mt-6">
          <CommentsPanel
            assignmentId={assignmentId}
            fieldOptions={initial.fields.map((f) => ({ fieldKey: f.fieldKey, label: f.label }))}
          />
        </div>
      )}
    </div>
  );
}
