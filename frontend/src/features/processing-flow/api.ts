import { api } from '@/lib/api';
import type {
  CalendarExpectation,
  CalendarYearDto,
  CalendarYearRead,
  CalendarYearSummaryDto,
  CreateFlowBody,
  FlowDetailDto,
  FlowSummaryDto,
  LegalTemplateDto,
  PreviewScheduleBody,
  RecordKind,
  SaveCalendarYearBody,
  SaveStepsResult,
  SchedulePreviewDto,
  StepPayload,
  UpdateFlowBody,
} from './types';

const data = <T>(r: { data: T }): T => r.data;

const BASE = '/processing-flows';
const part = (s: string): string => encodeURIComponent(s);

/** Every call of the flow settings screen. The server answers 404 while the switch `processing_flow` is off. */
export const processingFlowApi = {
  list: (opts: { includeArchived: boolean; recordKind?: RecordKind }) =>
    api
      .get<FlowSummaryDto[]>(BASE, {
        params: { ...(opts.recordKind ? { recordKind: opts.recordKind } : {}), ...(opts.includeArchived ? { includeArchived: true } : {}) },
      })
      .then(data),

  templates: () => api.get<LegalTemplateDto[]>(`${BASE}/templates`).then(data),

  get: (id: string) => api.get<FlowDetailDto>(`${BASE}/${part(id)}`).then(data),

  create: (body: CreateFlowBody) => api.post<FlowDetailDto>(BASE, body).then(data),

  update: (id: string, body: UpdateFlowBody) => api.patch<FlowDetailDto>(`${BASE}/${part(id)}`, body).then(data),

  setBindings: (id: string, directoryIds: string[], deadlineGroups: string[], expectedRevision: number) =>
    api.put<FlowDetailDto>(`${BASE}/${part(id)}/bindings`, { directoryIds, deadlineGroups, expectedRevision }).then(data),

  archive: (id: string, expectedRevision: number) => api.post<FlowDetailDto>(`${BASE}/${part(id)}/archive`, { expectedRevision }).then(data),

  restore: (id: string, expectedRevision: number) => api.post<FlowDetailDto>(`${BASE}/${part(id)}/restore`, { expectedRevision }).then(data),

  remove: (id: string, expectedRevision: number, confirmName: string) =>
    api.delete<{ deleted: true; id: string }>(`${BASE}/${part(id)}`, { params: { expectedRevision, confirmName } }).then(data),

  createDraft: (id: string) => api.post<FlowDetailDto>(`${BASE}/${part(id)}/versions`).then(data),

  /** `expectedRevision` is the revision of the VERSION that was looked at, not of the flow. */
  saveSteps: (id: string, versionId: string, steps: StepPayload[], expectedRevision: number) =>
    api.put<SaveStepsResult>(`${BASE}/${part(id)}/versions/${part(versionId)}/steps`, { steps, expectedRevision }).then(data),

  deleteDraft: (id: string, versionId: string, expectedRevision: number) =>
    api.delete<FlowDetailDto>(`${BASE}/${part(id)}/versions/${part(versionId)}`, { params: { expectedRevision } }).then(data),

  publish: (id: string, versionId: string, expectedRevision: number) =>
    api.post<FlowDetailDto>(`${BASE}/${part(id)}/versions/${part(versionId)}/publish`, { expectedRevision }).then(data),

  verifyLegal: (id: string, versionId: string, stepKey: string, expectedRevision: number) =>
    api
      .post<FlowDetailDto>(`${BASE}/${part(id)}/versions/${part(versionId)}/steps/${part(stepKey)}/verify-legal`, { expectedRevision })
      .then(data),

  unverifyLegal: (id: string, versionId: string, stepKey: string, expectedRevision: number) =>
    api
      .post<FlowDetailDto>(`${BASE}/${part(id)}/versions/${part(versionId)}/steps/${part(stepKey)}/unverify-legal`, { expectedRevision })
      .then(data),

  /** Writes nothing: the deadlines the steps sent would get on an imagined record. */
  previewSchedule: (body: PreviewScheduleBody, signal?: AbortSignal) =>
    api.post<SchedulePreviewDto>(`${BASE}/preview-schedule`, body, signal ? { signal } : {}).then(data),
};

const YEARS = '/processing-calendar/years';

export const processingCalendarApi = {
  list: () => api.get<CalendarYearSummaryDto[]>(YEARS).then(data),

  get: (year: number) => api.get<CalendarYearRead>(`${YEARS}/${year}`).then(data),

  save: (year: number, body: SaveCalendarYearBody) => api.put<CalendarYearDto>(`${YEARS}/${year}`, body).then(data),

  confirm: (year: number, expected: CalendarExpectation) => api.post<CalendarYearDto>(`${YEARS}/${year}/confirm`, { expected }).then(data),

  unconfirm: (year: number, expected: CalendarExpectation) =>
    api.post<CalendarYearDto>(`${YEARS}/${year}/unconfirm`, { expected }).then(data),

  remove: (year: number, expected: CalendarExpectation) =>
    api.delete<{ deleted: true; year: number; id: string }>(`${YEARS}/${year}`, { params: { id: expected.id, revision: expected.revision } }).then(data),
};
