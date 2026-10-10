import { api } from '@/lib/api';
import { triggerDownload } from '@/features/document-templates/export.api';
import type {
  ActiveGrantView,
  AssignmentSummary,
  BulkGrantUnlockResult,
  ExportCreateResultView,
  FinalizeResultView,
  PeriodSummaryView,
  ReopenResultView,
  ReportHistoryView,
  ReportSetupSummary,
  SaveReportConfigPayload,
  SaveReportConfigResult,
  SaveValuesResult,
  SheetInfo,
  SubmissionView,
  SummaryMode,
  TemplatePreviewResult,
  UnlockRequestView,
  ViewablePeriodView,
} from './types';

/**
 * REST client for /api/v1/bao-cao-dong. The backend
 * (dynamic-reports/reports.controller.ts) returns the array directly —
 * no `{success,data}` envelope — so this client does too.
 */
export const dynamicReportsApi = {
  listForSetup: () =>
    api
      .get<ReportSetupSummary[]>('/bao-cao-dong/reports', { params: { mode: 'setup' } })
      .then((r) => r.data),

  listTemplateSheets: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<SheetInfo[]>('/bao-cao-dong/templates/sheets', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  previewTemplate: (file: File, selectedSheets: string[]) => {
    const form = new FormData();
    form.append('file', file);
    form.append('selectedSheets', JSON.stringify(selectedSheets));
    return api
      .post<TemplatePreviewResult>('/bao-cao-dong/templates/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** S05-S08 schedule preview (R7) — dates the real PeriodScheduler would also shift. */
  getNonWorkingDates: (from: string, to: string) =>
    api
      .get<{ dates: string[] }>('/bao-cao-dong/schedule/non-working-dates', {
        params: { from, to },
      })
      .then((r) => r.data.dates),

  /** S09/S10 — the wizard's final step, first time anything is actually persisted. */
  saveReportConfig: (file: File, config: SaveReportConfigPayload) => {
    const form = new FormData();
    form.append('file', file);
    form.append('config', JSON.stringify(config));
    return api
      .post<SaveReportConfigResult>('/bao-cao-dong/reports', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** S11 thanh trên's combo — every assignment the caller is an editor of. */
  listMySubmissions: () =>
    api.get<AssignmentSummary[]>('/bao-cao-dong/submissions').then((r) => r.data),

  getSubmission: (assignmentId: string) =>
    api
      .get<SubmissionView>(`/bao-cao-dong/submissions/${assignmentId}`)
      .then((r) => r.data),

  saveSubmissionValues: (
    assignmentId: string,
    values: Record<string, string | null>,
    expectedRevision: string,
  ) =>
    api
      .patch<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/values`, {
        values,
        expectedRevision,
      })
      .then((r) => r.data),

  submitSubmission: (assignmentId: string, expectedRevision: string) =>
    api
      .post<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/submit`, {
        expectedRevision,
      })
      .then((r) => r.data),

  /** S33/PR7 — the manager's own list (any report they manage, or every report with admin:DynamicReport). */
  listForManager: () =>
    api.get<AssignmentSummary[]>('/bao-cao-dong/submissions/manager').then((r) => r.data),

  getSubmissionForManager: (assignmentId: string) =>
    api
      .get<SubmissionView>(`/bao-cao-dong/submissions/${assignmentId}/review`)
      .then((r) => r.data),

  approveSubmission: (assignmentId: string, expectedRevision: string, reason?: string) =>
    api
      .post<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/approve`, {
        expectedRevision,
        reason,
      })
      .then((r) => r.data),

  returnSubmission: (
    assignmentId: string,
    expectedRevision: string,
    reason: string,
    returnDueAt: string,
  ) =>
    api
      .post<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/return`, {
        expectedRevision,
        reason,
        returnDueAt,
      })
      .then((r) => r.data),

  unapproveSubmission: (assignmentId: string, expectedRevision: string, reason?: string) =>
    api
      .post<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/unapprove`, {
        expectedRevision,
        reason,
      })
      .then((r) => r.data),

  /** S15 thu nhỏ (PR7 slice 2). */
  getPeriodSummary: (periodId: string, mode: SummaryMode) =>
    api
      .get<PeriodSummaryView>(`/bao-cao-dong/periods/${periodId}/summary`, {
        params: { mode },
      })
      .then((r) => r.data),

  /** S17 (PR7 slice 4). `expiresAt` omitted lets the server default to now+3h (D07). */
  grantUnlock: (assignmentId: string, reason: string, expiresAt?: string) =>
    api
      .post<ActiveGrantView>(`/bao-cao-dong/submissions/${assignmentId}/unlock`, {
        reason,
        expiresAt,
      })
      .then((r) => r.data),

  revokeUnlock: (assignmentId: string, reason: string) =>
    api
      .post<void>(`/bao-cao-dong/submissions/${assignmentId}/unlock/revoke`, { reason })
      .then((r) => r.data),

  /** S38 (PR7 slice 6). */
  finalizePeriod: (periodId: string) =>
    api
      .post<FinalizeResultView>(`/bao-cao-dong/periods/${periodId}/finalize`, {})
      .then((r) => r.data),

  reopenPeriod: (periodId: string, reason: string) =>
    api
      .post<ReopenResultView>(`/bao-cao-dong/periods/${periodId}/reopen`, { reason })
      .then((r) => r.data),

  /** S25 (PR7 slice 7) — create the export row (persisted, TTL 24h), then fetch its bytes. */
  exportPeriod: (periodId: string) =>
    api
      .post<ExportCreateResultView>(`/bao-cao-dong/periods/${periodId}/export`, {})
      .then((r) => r.data),

  /** Triggers the browser download directly; `fileName` from `exportPeriod` is the fallback. */
  downloadExport: async (exportId: string, fileName: string) => {
    const response = await api.get<Blob>(`/bao-cao-dong/exports/${exportId}/download`, {
      responseType: 'blob',
    });
    triggerDownload(response, fileName);
  },

  /** S34 (PR7 slice 8) — the editor-side half: ask the manager to reopen a locked assignment. */
  requestUnlock: (assignmentId: string, reason: string) =>
    api
      .post<UnlockRequestView>(`/bao-cao-dong/submissions/${assignmentId}/unlock/request`, {
        reason,
      })
      .then((r) => r.data),

  /** S34 — the manager's reopen-request queue. */
  listUnlockRequests: () =>
    api.get<UnlockRequestView[]>('/bao-cao-dong/submissions/unlock-requests').then((r) => r.data),

  decideUnlockRequest: (
    unlockId: string,
    decision: 'APPROVE' | 'REJECT',
    decisionReason?: string,
    expiresAt?: string,
  ) =>
    api
      .post<void>(`/bao-cao-dong/submissions/unlock-requests/${unlockId}/decide`, {
        decision,
        decisionReason,
        expiresAt,
      })
      .then((r) => r.data),

  /** S34 — grant a window to several assignments at once (e.g. every still-overdue team). */
  bulkGrantUnlock: (assignmentIds: string[], reason: string, expiresAt?: string) =>
    api
      .post<BulkGrantUnlockResult>('/bao-cao-dong/submissions/unlock/bulk-grant', {
        assignmentIds,
        reason,
        expiresAt,
      })
      .then((r) => r.data),

  /** S21 (PR7 slice 8) — whole-period history/audit, every assignment at once. */
  getReportHistory: (periodId: string) =>
    api
      .get<ReportHistoryView>(`/bao-cao-dong/periods/${periodId}/history`)
      .then((r) => r.data),

  /** T-VIEWER-NAV — every OPEN period the caller (manager OR viewer) has standing on. */
  listViewablePeriods: () =>
    api.get<ViewablePeriodView[]>('/bao-cao-dong/periods').then((r) => r.data),
};
