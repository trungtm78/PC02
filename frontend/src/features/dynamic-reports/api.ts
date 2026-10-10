import { api } from '@/lib/api';
import type {
  AssignmentSummary,
  ReportSetupSummary,
  SaveReportConfigPayload,
  SaveReportConfigResult,
  SaveValuesResult,
  SheetInfo,
  SubmissionView,
  TemplatePreviewResult,
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
};
