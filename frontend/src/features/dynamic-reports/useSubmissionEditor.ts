import { useRef, useState } from 'react';
import { randomUUID } from '@/lib/uuid';
import { extractApiError } from '@/lib/api-errors';
import { dynamicReportsApi } from './api';
import { createSaveQueue } from './saveQueue';
import type {
  DynReportSubmissionState,
  ImportPreviewResult,
  SubmissionView,
  TypedValue,
} from './types';

/**
 * Everything S11 does to a submission that is not drawing it: the values the
 * officer has typed, saving them (one request at a time, autosave, retry,
 * 409 resolution), importing an Excel file, reloading, and submitting.
 *
 * It was extracted unchanged from `SubmissionInputPage` so that the list form
 * and the spreadsheet grid edit through the same code: one queue, one set of
 * refs, one rule for what "saved" means. The page's own tests are the contract.
 *
 * H0 rules that must survive any refactor:
 *  - saves are serialised through one queue and always read the latest
 *    *acknowledged* revision and typed values from refs, never from a render
 *    closure (stale by the time a queued save runs);
 *  - a failed save puts every key back in the dirty set, and "Nộp" refuses to
 *    run while anything is dirty.
 */

const AUTOSAVE_IDLE_MS = 2000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ConflictState {
  mineByKey: Record<string, string | null>;
  serverByKey: Record<string, TypedValue | undefined>;
  serverRevision: string;
  serverEffectiveLockAt: string | null;
}

export interface SubmissionEditorOptions {
  assignmentId: string | undefined;
  initial: SubmissionView | undefined;
  refetch: () => Promise<{ data?: SubmissionView }>;
}

export function useSubmissionEditor({ assignmentId, initial, refetch }: SubmissionEditorOptions) {
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
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'previewing' | 'applying' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [ruleErrors, setRuleErrors] = useState<string[]>([]);
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  // Until this tab has had a save acknowledged, the query is the source of
  // truth — follow it so a background refetch ("Tải lại", window focus) can
  // never leave saves pinned to a revision older than what is displayed.
  // After the first acknowledgement `acceptRevision` owns the ref.
  if (initial && revisionOverride === null) revisionRef.current = initial.revision;

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
    // `initial.values` is the query cache and predates the conflicting save,
    // so falling back to it would show a value the server no longer has.
    // Adopt the snapshot the conflict dialog just fetched instead.
    const next = { ...valuesRef.current };
    for (const key of keys) next[key] = conflict.serverByKey[key]?.v ?? '';
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

  /** S35 — no DB write yet: shows the diff and waits for explicit confirmation. */
  async function previewImport(file: File) {
    if (!assignmentId) return;
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
    // An import still in flight may yet fail; submitting now could lock the
    // pre-import server copy.
    if (importStatus === 'applying') return;
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
      // Revision is read when the task actually runs, not when it is queued:
      // anything ahead of it in the queue may have advanced it.
      const result = await saveQueue.enqueue(() =>
        dynamicReportsApi.submitSubmission(
          targetAssignmentId,
          revisionRef.current ?? currentRevision,
        ),
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

  /**
   * "Tải lại" — adopt the server's current snapshot as the new baseline:
   * local overrides, unsaved edits and the revision all reset together, so
   * the next save is built from exactly what is on screen.
   */
  async function handleReload() {
    if (timerRef.current) clearTimeout(timerRef.current);
    const result = await refetch();
    const fresh = result.data;
    if (!fresh) return;
    // Behind any in-flight save so its acknowledgement cannot land afterwards
    // and resurrect the pre-reload revision.
    await saveQueue.enqueue(async () => {
      valuesRef.current = {};
      dirtyRef.current = new Set();
      idempotencyRef.current = null;
      revisionRef.current = fresh.revision;
      setValues({});
      setRevisionOverride(null);
      setEditableOverride(null);
      setLockAtOverride(null);
      setStateOverride(null);
      setFieldErrors({});
      setConflict(null);
      setSaveError(null);
      setCanRetrySave(false);
      setRuleErrors([]);
      setSaveStatus('idle');
    });
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
   * Several cells at once (a paste, an undo, a "clear selection"): all are
   * marked dirty together and saved in one request straight away, not after
   * the idle delay, because the officer has finished an action.
   */
  function applyValues(batch: Record<string, string>) {
    const next = { ...valuesRef.current, ...batch };
    valuesRef.current = next;
    for (const key of Object.keys(batch)) dirtyRef.current.add(key);
    setValues(next);
    setSaveError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    void flushAll();
  }

  /** Shows a problem the page found before anything was sent (e.g. a paste that was refused). */
  function reportProblem(message: string) {
    setSaveStatus('error');
    setSaveError(message);
  }

  return {
    // what is on screen
    values,
    revision,
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
    /** The text of a field: what the officer typed, else what the server holds. */
    valueOf: (fieldKey: string): string => values[fieldKey] ?? initial?.values[fieldKey]?.v ?? '',
    // actions
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
    /** Saves the latest typed text of every dirty key now (used by the explicit "Thử lại" button). */
    retrySave: () => void flushAll(),
    /** Current typed text without going through React state (for event handlers). */
    peekValue: (fieldKey: string): string | undefined => valuesRef.current[fieldKey],
  };
}
