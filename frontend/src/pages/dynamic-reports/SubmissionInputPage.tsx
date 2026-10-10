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
import { ArrowLeft, AlertCircle, CheckCircle2, Clock, Lock, Send } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { DynReportSubmissionState } from '@/features/dynamic-reports/types';
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
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revision = revisionOverride ?? initial?.revision ?? null;
  const editable = editableOverride ?? initial?.editable ?? true;
  const effectiveLockAt = lockAtOverride ?? initial?.effectiveLockAt ?? null;
  const state = stateOverride ?? initial?.state ?? 'NOT_STARTED';

  async function flush(current: Record<string, string>) {
    if (!assignmentId || !revision || dirtyRef.current.size === 0) return;
    const patch: Record<string, string | null> = {};
    for (const key of dirtyRef.current) {
      patch[key] = current[key]?.trim() ? current[key] : null;
    }
    dirtyRef.current = new Set();
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const result = await dynamicReportsApi.saveSubmissionValues(assignmentId, patch, revision);
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
        setSaveError('Bản nộp đã được sửa ở một phiên khác — tải lại trang để lấy bản mới nhất.');
      } else if (apiError.code === 'CELL_VALIDATION') {
        setSaveError(apiError.message);
        const m = /Ô "([^"]+)"/.exec(apiError.message);
        if (m) setFieldErrors((prev) => ({ ...prev, [m[1]]: apiError.message }));
      } else if (apiError.code === 'REPORT_LOCKED') {
        setEditableOverride(false);
        setSaveError('Kỳ đã khoá — không thể lưu thêm.');
      } else {
        setSaveError(apiError.message);
      }
      setSaveStatus('error');
    }
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
      } else {
        setSaveError(apiError.message);
      }
      setSaveStatus('error');
    } finally {
      setSubmitting(false);
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
          className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2"
          data-testid="locked-banner"
        >
          <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Đã khoá, không thể sửa thêm
            {effectiveLockAt ? ` lúc ${formatVNDateTime(effectiveLockAt)}` : ''}.
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
        <p className="text-sm text-red-700 mb-4" data-testid="save-error">
          {saveError}
        </p>
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
