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
import { useSubmissionEditor } from '@/features/dynamic-reports/useSubmissionEditor';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, Clock, Download, FileSpreadsheet, List, Lock, Table2, Unlock, Send } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type {
  DynReportSubmissionState,
  SubmissionFieldView,
} from '@/features/dynamic-reports/types';
import { planPaste } from '@/features/dynamic-reports/engine/generated/paste';
import { validateFieldValue } from '@/features/dynamic-reports/engine/generated/values';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import CommentsPanel from './CommentsPanel';
import GridViewer from '@/features/dynamic-reports/grid/GridViewer';
import { useGridLayout } from '@/features/dynamic-reports/grid/useGridLayout';

const EDITABLE_STATES: readonly DynReportSubmissionState[] = ['NOT_STARTED', 'DRAFT', 'RETURNED'];

export default function SubmissionInputPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { data: initial, isLoading, isError, refetch } = useQuery({
    queryKey: ['dynamic-reports', 'submission', assignmentId],
    queryFn: () => dynamicReportsApi.getSubmission(assignmentId as string),
    enabled: !!assignmentId,
  });

  // Saving, autosave, 409 resolution, Excel import, reload and submit live in
  // the editor hook so the list form and the grid edit through the same code.
  const {
    values,
    editable,
    effectiveLockAt,
    state,
    saveStatus,
    saveError,
    fieldErrors,
    submitting,
    canRetrySave,
    conflict,
    ruleErrors,
    importPreview,
    importStatus,
    importError,
    valueOf,
    handleChange,
    handleBlur,
    applyValues,
    reportProblem,
    flushAll,
    handleSubmit,
    handleReload,
    resolveConflictKeepMine,
    resolveConflictUseServer,
    previewImport,
    handleApplyImport,
    handleCancelImport,
  } = useSubmissionEditor({ assignmentId, initial, refetch });

  // A request made earlier (another visit, another tab) and still waiting is "sent" as soon as the submission has
  // loaded, so it can be taken back; what the person does on this screen overrides it from then on.
  const [requestOverride, setRequestStatus] = useState<'idle' | 'working' | 'sent' | 'error' | null>(null);
  const requestStatus: 'idle' | 'working' | 'sent' | 'error' =
    requestOverride ?? (initial?.pendingUnlockRequest ? 'sent' : 'idle');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (importFileInputRef.current) importFileInputRef.current.value = '';
    if (!file) return;
    await previewImport(file);
  }

  /** The way back of "Xin mở lại": take the request back while it is still waiting for a manager. */
  async function handleWithdrawUnlock() {
    if (!assignmentId) return;
    setRequestStatus('working');
    setRequestError(null);
    try {
      await dynamicReportsApi.withdrawUnlockRequest(assignmentId);
      setRequestStatus('idle');
    } catch (err) {
      setRequestStatus('sent');
      setRequestError(extractApiError(err).message);
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
      reportProblem(plan.error.message);
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
        reportProblem(`Ô "${sheetKey}!${cell.address}": ${validation.error.message}`);
        return;
      }
      normalized[`${sheetKey}!${cell.address}`] = validation.value.v ?? '';
    }

    applyValues(normalized);
  }

  // The grid is the default; the emergency switch (flag dynamic_reports_grid) and a narrow screen bring the list back. Remember WHICH
  // template version failed to build, so moving to another assignment does not keep it disabled.
  const { layoutMode, setLayoutMode, gridAllowed } = useGridLayout();
  const [unavailableVersionId, setUnavailableVersionId] = useState<string | null>(null);
  const gridUnavailable = initial !== undefined && unavailableVersionId === initial.versionId;
  const [gridProblem, setGridProblem] = useState<string | null>(null);
  const canType = editable && !submitting && importStatus !== 'applying';
  // What the grid draws and recomputes from: every field's current text, typed or saved.
  const gridValues = useMemo(
    () =>
      Object.fromEntries(
        (initial?.fields ?? []).map((f) => [f.fieldKey, { v: valueOf(f.fieldKey) || null }]),
      ),
    // `values` is what changes when the officer types; valueOf reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial, values],
  );

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
    <div
      className={`${layoutMode === 'grid' && !gridUnavailable ? 'max-w-6xl' : 'max-w-3xl'} mx-auto p-6`}
      data-testid="submission-input-page"
    >
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
              <button
                type="button"
                data-testid="btn-withdraw-unlock"
                onClick={() => void handleWithdrawUnlock()}
                className={`ml-2 underline hover:text-amber-900 ${A11Y_FOCUS_RING}`}
              >
                Rút lại
              </button>
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
              disabled={importStatus === 'applying' || submitting || importPreview.diff.length === 0}
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

      {gridUnavailable && (
        <p className="text-sm text-amber-700 mb-3" data-testid="grid-fallback-note">
          Chưa dựng được lưới cho mẫu này — đang dùng dạng danh sách.
        </p>
      )}

      {gridAllowed && (
        <div className="flex gap-2 mb-3" role="group" aria-label="Cách nhập số liệu">
          <button
            type="button"
            data-testid="layout-list"
            aria-pressed={layoutMode === 'list'}
            onClick={() => setLayoutMode('list')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border ${
              layoutMode === 'list' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'
            } ${A11Y_FOCUS_RING}`}
          >
            <List className="w-3.5 h-3.5" />
            Dạng danh sách
          </button>
          <button
            type="button"
            data-testid="layout-grid"
            aria-pressed={layoutMode === 'grid'}
            disabled={gridUnavailable}
            onClick={() => setLayoutMode('grid')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded border disabled:opacity-50 ${
              layoutMode === 'grid' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'
            } ${A11Y_FOCUS_RING}`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Dạng lưới
          </button>
        </div>
      )}

      {layoutMode === 'grid' && !gridUnavailable && (
        <div className="mb-4" data-testid="grid-section">
          <GridViewer
            versionId={initial.versionId}
            fields={initial.fields}
            values={gridValues}
            entry={{
              fields: initial.fields,
              editable: canType,
              valueOf,
              onChange: handleChange,
              onChangeMany: (batch) => applyValues(batch),
              onLeave: handleBlur,
              onProblem: setGridProblem,
              serverErrors: fieldErrors,
            }}
            onUnavailable={() => {
              setUnavailableVersionId(initial.versionId);
              setLayoutMode('list');
            }}
          />
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} hidden={layoutMode === 'grid' && !gridUnavailable}>
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
                    value={valueOf(f.fieldKey)}
                    disabled={!editable || submitting || importStatus === 'applying'}
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
          onClick={() => void handleReload()}
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
          disabled={!editable || submitting || importStatus === 'applying'}
          onClick={() => {
            // A value the grid refused is still sitting in its editor: submitting now would send the
            // number the officer is NOT looking at.
            if (layoutMode === 'grid' && gridProblem) {
              reportProblem(gridProblem);
              return;
            }
            void handleSubmit();
          }}
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
