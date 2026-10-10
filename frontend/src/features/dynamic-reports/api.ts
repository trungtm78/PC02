import { api } from '@/lib/api';
import type { ReportSetupSummary, SheetInfo, TemplatePreviewResult } from './types';

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
};
