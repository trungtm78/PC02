import { api } from '@/lib/api';
import { triggerDownload } from '@/features/document-templates/export.api';
import type { GridModel } from './engine/generated/grid-types';
import type {
  ActiveGrantView,
  AssignmentListItemView,
  AssignmentSummary,
  BulkGrantUnlockResult,
  CommentView,
  ExportCreateResultView,
  FinalizeResultView,
  ImportPreviewResult,
  MidPeriodAssignmentView,
  MidPeriodImpactPreview,
  PeriodSummaryView,
  ReopenResultView,
  ReportHistoryView,
  ReportDeletionImpact,
  ReportDetailView,
  CreateVersionResult,
  PeriodDeletionImpact,
  UpdateReportConfigPayload,
  UpdateReportConfigResult,
  SaveReportVersionPayload,
  ReportOption,
  ReportSetupSummary,
  TeamFilterOption,
  SaveReportConfigPayload,
  SaveReportConfigResult,
  SaveValuesResult,
  SheetInfo,
  StatusListFilters,
  StatusListResult,
  StatusMatrixView,
  SubmissionView,
  SummaryMode,
  TemplatePreviewResult,
  ValidateForSubmitResult,
  VersionListItem,
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

  /** S31 "Ngừng phát sinh" — stops future periods; any already-OPEN period keeps running. */
  suspendReportGeneration: (reportId: string) =>
    api
      .post<{ status: 'SUSPENDED' }>(`/bao-cao-dong/reports/${reportId}/suspend`, {})
      .then((r) => r.data),

  /** The counterpart of S31: a suspended report generates periods again. */
  resumeReportGeneration: (reportId: string) =>
    api
      .post<{ status: 'PUBLISHED' }>(`/bao-cao-dong/reports/${reportId}/resume`, {})
      .then((r) => r.data),

  /** "Xuất bản" a report that was only saved as a draft: the stored configuration goes live as it is. */
  publishDraftReport: (reportId: string) =>
    api
      .post<{ reportId: string; versionId: string; version: number; status: 'PUBLISHED' }>(
        `/bao-cao-dong/reports/${reportId}/publish`,
        {},
      )
      .then((r) => r.data),

  /** S01 "Xem" — the whole configuration of one report. */
  getReportDetail: (reportId: string) =>
    api.get<ReportDetailView>(`/bao-cao-dong/reports/${reportId}`).then((r) => r.data),

  /** "Sửa cấu hình" — name, description, schedule, managers, teams and editors (from the next period, D09). */
  updateReportConfig: (reportId: string, body: UpdateReportConfigPayload) =>
    api.patch<UpdateReportConfigResult>(`/bao-cao-dong/reports/${reportId}`, body).then((r) => r.data),

  /** Hide a report and stop it generating periods; every figure stays. */
  archiveReport: (reportId: string) =>
    api.post<{ status: 'ARCHIVED' }>(`/bao-cao-dong/reports/${reportId}/archive`, {}).then((r) => r.data),

  unarchiveReport: (reportId: string) =>
    api.post<{ status: 'SUSPENDED' }>(`/bao-cao-dong/reports/${reportId}/unarchive`, {}).then((r) => r.data),

  /** What deleting would destroy — read before the confirmation is shown. */
  getReportDeletionImpact: (reportId: string) =>
    api.get<ReportDeletionImpact>(`/bao-cao-dong/reports/${reportId}/deletion-impact`).then((r) => r.data),

  /** Delete a report nobody has entered anything into (409 HAS_DATA otherwise). */
  deleteReport: (reportId: string) =>
    api.delete<{ deleted: true }>(`/bao-cao-dong/reports/${reportId}`).then((r) => r.data),

  /** Admin only: delete the report together with every figure; the report code must be typed back. */
  deleteReportWithData: (reportId: string, confirmCode: string) =>
    api
      .delete<{ deleted: true }>(`/bao-cao-dong/reports/${reportId}/with-data`, { params: { confirmCode } })
      .then((r) => r.data),

  /** "Cập nhật mẫu" — a new version of the template (D09 decides which open periods take it at once). */
  createReportVersion: (reportId: string, file: File, config: SaveReportVersionPayload) => {
    const form = new FormData();
    form.append('file', file);
    form.append('config', JSON.stringify(config));
    return api
      .post<CreateVersionResult>(`/bao-cao-dong/reports/${reportId}/versions`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  /** Remove a version nobody depends on (a draft, or a retired one no period was generated from). */
  deleteReportVersion: (reportId: string, versionId: string) =>
    api
      .delete<{ deleted: true }>(`/bao-cao-dong/reports/${reportId}/versions/${versionId}`)
      .then((r) => r.data),

  /** Save one version's template to the person's disk, to edit in Excel and upload again through "Cập nhật mẫu". */
  saveVersionFileToDisk: async (reportId: string, versionId: string, fileName: string): Promise<void> => {
    const response = await api.get<Blob>(`/bao-cao-dong/reports/${reportId}/versions/${versionId}/file`, {
      responseType: 'blob',
    });
    triggerDownload(response, fileName);
  },

  /** The template file of one version, as a File — the wizard can start from the file the report already has. */
  downloadVersionFile: async (reportId: string, versionId: string, fileName: string): Promise<File> => {
    const r = await api.get<Blob>(`/bao-cao-dong/reports/${reportId}/versions/${versionId}/file`, {
      responseType: 'blob',
    });
    return new File([r.data], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  },

  /** S22 "Danh sách phiên bản". */
  listVersions: (reportId: string) =>
    api
      .get<VersionListItem[]>(`/bao-cao-dong/reports/${reportId}/versions`)
      .then((r) => r.data),

  /** S11 thanh trên's combo — every assignment the caller is an editor of. */
  listMySubmissions: () =>
    api.get<AssignmentSummary[]>('/bao-cao-dong/submissions').then((r) => r.data),

  /**
   * The render-ready template grid of one report version. A version's file is
   * write-once, so this never changes for a given id; the server also sends an
   * ETag, which the browser uses to revalidate across sessions without
   * downloading the model again.
   */
  getVersionGrid: (versionId: string) =>
    api
      .get<GridModel>(`/bao-cao-dong/versions/${versionId}/grid`)
      .then((r) => r.data),

  getSubmission: (assignmentId: string) =>
    api
      .get<SubmissionView>(`/bao-cao-dong/submissions/${assignmentId}`)
      .then((r) => r.data),

  /** `idempotencyKey` (S26, PR6 slice 7) lets a network-error retry resend the exact same request safely. */
  saveSubmissionValues: (
    assignmentId: string,
    values: Record<string, string | null>,
    expectedRevision: string,
    idempotencyKey?: string,
  ) =>
    api
      .patch<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/values`, {
        values,
        expectedRevision,
        idempotencyKey,
      })
      .then((r) => r.data),

  submitSubmission: (assignmentId: string, expectedRevision: string) =>
    api
      .post<SaveValuesResult>(`/bao-cao-dong/submissions/${assignmentId}/submit`, {
        expectedRevision,
      })
      .then((r) => r.data),

  /** S36 (PR9 slice 1) — read-only rule-violation preview, called before "Nộp". */
  validateForSubmit: (assignmentId: string) =>
    api
      .get<ValidateForSubmitResult>(`/bao-cao-dong/submissions/${assignmentId}/validate`)
      .then((r) => r.data),

  /** S37 (PR9 slice 2) — "Ghi chú/giải trình", readable/writable by either the editor or the report's manager. */
  listComments: (assignmentId: string) =>
    api
      .get<CommentView[]>(`/bao-cao-dong/submissions/${assignmentId}/comments`)
      .then((r) => r.data),

  addComment: (assignmentId: string, fieldKey: string | null, body: string) =>
    api
      .post<CommentView>(`/bao-cao-dong/submissions/${assignmentId}/comments`, {
        fieldKey: fieldKey ?? undefined,
        body,
      })
      .then((r) => r.data),

  /** Edit your own comment (design standard: created => editable). */
  updateComment: (assignmentId: string, commentId: string, body: string) =>
    api
      .patch<CommentView>(`/bao-cao-dong/submissions/${assignmentId}/comments/${commentId}`, { body })
      .then((r) => r.data),

  /** Delete a comment: your own, or (a manager) anyone's. Not once the period is closed. */
  deleteComment: (assignmentId: string, commentId: string) =>
    api
      .delete<{ deleted: true }>(`/bao-cao-dong/submissions/${assignmentId}/comments/${commentId}`)
      .then((r) => r.data),

  /** S30 — bỏ miễn nộp (chiều ngược của miễn nộp). */
  unexemptTeamMidPeriod: (periodId: string, assignmentId: string) =>
    api
      .post<MidPeriodAssignmentView>(`/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/unexempt`, {})
      .then((r) => r.data),

  /** S30 — gỡ tổ đã thêm nhầm giữa kỳ, khi chưa ai nhập gì. */
  removeAddedTeamMidPeriod: (periodId: string, assignmentId: string) =>
    api
      .delete<{ removed: true; teamName: string }>(`/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}`)
      .then((r) => r.data),

  /** What deleting the period would destroy. */
  getPeriodDeletionImpact: (periodId: string) =>
    api.get<PeriodDeletionImpact>(`/bao-cao-dong/periods/${periodId}/deletion-impact`).then((r) => r.data),

  /** Delete a period nobody entered anything in (409 HAS_DATA otherwise). */
  deletePeriod: (periodId: string) =>
    api.delete<{ deleted: true; periodKey: string }>(`/bao-cao-dong/periods/${periodId}`).then((r) => r.data),

  /** Admin only: delete the period with its figures; the period key must be typed back. */
  deletePeriodWithData: (periodId: string, confirmKey: string) =>
    api
      .delete<{ deleted: true; periodKey: string }>(`/bao-cao-dong/periods/${periodId}/with-data`, {
        params: { confirmKey },
      })
      .then((r) => r.data),

  /** S34 — the editor takes back their own reopening request while it is still waiting. */
  withdrawUnlockRequest: (assignmentId: string) =>
    api.delete<{ withdrawn: true }>(`/bao-cao-dong/submissions/${assignmentId}/unlock/request`).then((r) => r.data),

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
  /**
   * `acknowledgedBasis`: the sentence the server showed (UNAPPROVED_TEAMS) about the teams the official numbers leave
   * out, sent back to say yes to exactly that. If the teams changed meanwhile the sentence no longer matches and the
   * server asks again.
   */
  finalizePeriod: (periodId: string, acknowledgedBasis?: string) =>
    api
      .post<FinalizeResultView>(`/bao-cao-dong/periods/${periodId}/finalize`, acknowledgedBasis ? { acknowledgedBasis } : {})
      .then((r) => r.data),

  reopenPeriod: (periodId: string, reason: string) =>
    api
      .post<ReopenResultView>(`/bao-cao-dong/periods/${periodId}/reopen`, { reason })
      .then((r) => r.data),

  /** S30 (PR4 slice 6) — danh sách tổ của kỳ, để chọn tổ thêm/miễn nộp. */
  listAssignments: (periodId: string) =>
    api
      .get<AssignmentListItemView[]>(`/bao-cao-dong/periods/${periodId}/assignments`)
      .then((r) => r.data),

  previewAddTeam: (periodId: string, teamId: string) =>
    api
      .post<MidPeriodImpactPreview>(
        `/bao-cao-dong/periods/${periodId}/assignments/add-team/preview`,
        { teamId },
      )
      .then((r) => r.data),

  addTeamMidPeriod: (periodId: string, teamId: string, reason: string) =>
    api
      .post<MidPeriodAssignmentView>(
        `/bao-cao-dong/periods/${periodId}/assignments/add-team`,
        { teamId, reason },
      )
      .then((r) => r.data),

  previewExemptTeam: (periodId: string, assignmentId: string) =>
    api
      .post<MidPeriodImpactPreview>(
        `/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/exempt/preview`,
        {},
      )
      .then((r) => r.data),

  exemptTeamMidPeriod: (periodId: string, assignmentId: string, reason: string) =>
    api
      .post<MidPeriodAssignmentView>(
        `/bao-cao-dong/periods/${periodId}/assignments/${assignmentId}/exempt`,
        { reason },
      )
      .then((r) => r.data),

  /** S25 (PR7 slice 7) — create the export row (persisted, TTL 24h), then fetch its bytes. */
  exportPeriod: (periodId: string, mode?: 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED') =>
    api
      .post<ExportCreateResultView>(`/bao-cao-dong/periods/${periodId}/export`, mode ? { mode } : {})
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

  /** S35 (PR6 slice 8) — no DB write; returns the diff for the UI to show before committing. */
  previewExcelImport: (assignmentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportPreviewResult>(
        `/bao-cao-dong/submissions/${assignmentId}/import-excel/preview`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  /** `values` must be exactly what `previewExcelImport` returned, re-sent unchanged. */
  applyExcelImport: (
    assignmentId: string,
    values: Record<string, string | null>,
    expectedRevision: string,
  ) =>
    api
      .post<SaveValuesResult>(
        `/bao-cao-dong/submissions/${assignmentId}/import-excel/apply`,
        { values, expectedRevision },
      )
      .then((r) => r.data),

  /** S19/S23 (PR8 slice 1) — cross-report status table, page/pageSize optional (server defaults 25/caps 100). */
  listStatus: (filters: StatusListFilters, page?: number, pageSize?: number) =>
    api
      .get<StatusListResult>('/bao-cao-dong/status', {
        params: { ...filters, page, pageSize },
      })
      .then((r) => r.data),

  /** S19 "Xuất" (PR8 slice 2) — same filters as `listStatus`, every matching row, no pagination. */
  exportStatus: async (filters: StatusListFilters, format: 'csv' | 'xlsx') => {
    const response = await api.get<Blob>('/bao-cao-dong/status/export', {
      params: { ...filters, format },
      responseType: 'blob',
    });
    triggerDownload(response, `tinh-trang-nhap-lieu.${format}`);
  },

  /** S20 ma trận (PR8 slice 3) — report picker, same scope as `listStatus`. */
  listStatusReports: () =>
    api.get<ReportOption[]>('/bao-cao-dong/status/reports').then((r) => r.data),

  /** S20 — Tổ × Kỳ cho một báo cáo, tối đa 12 cột. */
  getStatusMatrix: (reportId: string) =>
    api
      .get<StatusMatrixView>('/bao-cao-dong/status/matrix', { params: { reportId } })
      .then((r) => r.data),

  /**
   * S27 "đơn vị" filter (PR8 slice 7) — flat team list, same `GET /teams` +
   * client-side filter (`isActive !== false && wardId == null`) already used
   * by `ReportTeamsStep.tsx` (S09 wizard). A deliberately scoped-down first
   * version of S27: a real tree picker (parent/child collapse) is a separate
   * future task if a flat list proves too long in practice — see PROGRESS.md.
   */
  listTeamsForFilter: async (): Promise<TeamFilterOption[]> => {
    const res = await api.get('/teams');
    const items = (Array.isArray(res.data) ? res.data : res.data?.data ?? []) as Array<{
      id: string;
      name: string;
      isActive?: boolean;
      wardId?: string | null;
    }>;
    return items
      .filter((t) => t.isActive !== false && t.wardId == null)
      .map((t) => ({ teamId: t.id, teamName: t.name }));
  },

  /** "Xuất bản của tổ" — the editor's own single-sheet export of this assignment's current values. */
  exportOwnSubmission: async (assignmentId: string) => {
    const response = await api.get<Blob>(
      `/bao-cao-dong/submissions/${assignmentId}/export`,
      { responseType: 'blob' },
    );
    triggerDownload(response, 'xuat-ban-cua-to.xlsx');
  },
};
