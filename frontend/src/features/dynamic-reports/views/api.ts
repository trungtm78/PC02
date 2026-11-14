import { api } from '@/lib/api';
import type {
  CustomReportBody,
  CustomReportExportResult,
  CustomReportPreview,
  ReportViewDto,
  TeamDirectoryEntry,
  ViewCreateInput,
  ViewUpdateInput,
} from './types';

/** The saved custom reports of one report (archived ones included). */
export const reportViewsKey = (reportId: string) => ['dynamic-reports', 'report-views', reportId] as const;
export const customReportCriteriaKey = (periodId: string) => ['dynamic-reports', 'custom-report', 'criteria', periodId] as const;
export const customReportTeamsKey = (periodId: string) => ['dynamic-reports', 'custom-report', 'teams', periodId] as const;
export const teamDirectoryKey = ['dynamic-reports', 'custom-report', 'team-directory'] as const;
/**
 * The status of the period is part of the key: a closed period is always counted on its approved figures, so the
 * answer read while it was open is not the answer after it was closed (and the other way round).
 */
export const customReportPreviewKey = (periodId: string, periodStatus: 'OPEN' | 'FINALIZED', request: string) =>
  ['dynamic-reports', 'custom-report', 'preview', periodId, periodStatus, request] as const;

/**
 * REST client of "Báo cáo tuỳ chọn". For managers and admins of the report only: anybody else gets 404 from every
 * route. The file of an export is downloaded with `dynamicReportsApi.downloadExport`.
 */
export const reportViewsApi = {
  list: (reportId: string) =>
    api
      .get<ReportViewDto[]>(`/bao-cao-dong/reports/${reportId}/views`, { params: { includeArchived: true } })
      .then((r) => r.data),

  create: (reportId: string, body: ViewCreateInput) =>
    api.post<ReportViewDto>(`/bao-cao-dong/reports/${reportId}/views`, body).then((r) => r.data),

  update: (viewId: string, body: ViewUpdateInput) =>
    api.patch<ReportViewDto>(`/bao-cao-dong/views/${viewId}`, body).then((r) => r.data),

  /** `expectedRevision` is the revision the screen holds: a change by somebody else in between is answered 409. */
  archive: (viewId: string, expectedRevision: number) =>
    api.post<ReportViewDto>(`/bao-cao-dong/views/${viewId}/archive`, { expectedRevision }).then((r) => r.data),

  restore: (viewId: string, expectedRevision: number) =>
    api.post<ReportViewDto>(`/bao-cao-dong/views/${viewId}/restore`, { expectedRevision }).then((r) => r.data),

  remove: (viewId: string, expectedRevision: number) =>
    api
      .delete<{ deleted: true; id: string }>(`/bao-cao-dong/views/${viewId}`, { params: { expectedRevision } })
      .then((r) => r.data),

  preview: (periodId: string, body: CustomReportBody) =>
    api.post<CustomReportPreview>(`/bao-cao-dong/periods/${periodId}/custom-preview`, body).then((r) => r.data),

  createExport: (periodId: string, body: CustomReportBody) =>
    api.post<CustomReportExportResult>(`/bao-cao-dong/periods/${periodId}/custom-export`, body).then((r) => r.data),

  /** Which team is under which (`GET /teams/options`, a bare array): the team picker draws a tree from it. */
  listTeamDirectory: async (): Promise<TeamDirectoryEntry[]> => {
    const res = await api.get('/teams/options');
    const items = (Array.isArray(res.data) ? res.data : (res.data?.data ?? [])) as Array<{
      id: string;
      name: string;
      parentId?: string | null;
    }>;
    return items.map((t) => ({ id: t.id, name: t.name, parentId: t.parentId ?? null }));
  },
};
