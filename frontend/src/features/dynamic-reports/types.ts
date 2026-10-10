/**
 * Mirrors backend/src/dynamic-reports/reports.service.ts response shapes
 * exactly, including field names — no renaming at the boundary.
 */
export type DynReportStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED';

export interface ReportSetupSummary {
  id: string;
  code: string;
  name: string;
  status: DynReportStatus;
  reportingUnit: string;
  effectiveFrom: string | null;
  updatedAt: string;
  periodType: string | null;
  nextDueAt: string | null;
  managers: string[];
  teamCount: number;
  latestVersion: number | null;
}
