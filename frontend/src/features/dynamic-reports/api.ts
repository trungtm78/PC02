import { api } from '@/lib/api';
import type { ReportSetupSummary } from './types';

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
};
