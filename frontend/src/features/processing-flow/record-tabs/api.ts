import { api } from '@/lib/api';
import { ApplyNotDone } from '../errors';
import type {
  AdjustDueBody,
  AssignPartyBody,
  CandidateDto,
  DecisionBody,
  EditReportBody,
  OpinionBody,
  ReasonBody,
  RecordFlowDto,
  RecordKind,
  ResultsDto,
  SubmitReportBody,
  WriteBase,
} from './types';

const data = <T>(r: { data: T }): T => r.data;
const part = (s: string): string => encodeURIComponent(s);
const recordPath = (kind: RecordKind, id: string): string => `/processing/records/${part(kind)}/${part(id)}`;
const stepPath = (kind: RecordKind, id: string, stepKey: string): string => `${recordPath(kind, id)}/steps/${part(stepKey)}`;

const post = <B>(url: string, body: B) => api.post<RecordFlowDto>(url, body).then(data);

/** `apply` and `reapply` answer `{ outcome, flow }`: the cache holds the flow, and an outcome without one is a refusal. */
const postApply = <B>(url: string, body: B): Promise<RecordFlowDto> =>
  api.post<{ outcome: string; flow: RecordFlowDto | null }>(url, body).then((r) => {
    const { outcome, flow } = r.data;
    if (!flow) throw new ApplyNotDone(outcome);
    return flow;
  });

/**
 * Every call of the two record tabs. The server answers 404 while the switch `processing_flow_records` is off, and
 * 404 `RECORD_FLOW_NOT_FOUND` for a record that has no flow (or that the person may not read). Every write answers the
 * WHOLE new flow of the record.
 */
export const processingRecordApi = {
  get: (kind: RecordKind, id: string) => api.get<RecordFlowDto>(recordPath(kind, id)).then(data),

  apply: (kind: RecordKind, id: string, body: { flowId?: string; idempotencyKey?: string } = {}) => postApply(`${recordPath(kind, id)}/apply`, body),
  reapply: (kind: RecordKind, id: string, body: WriteBase & { flowId?: string }) => postApply(`${recordPath(kind, id)}/reapply`, body),
  confirm: (kind: RecordKind, id: string, body: WriteBase) => post(`${recordPath(kind, id)}/confirm`, body),
  accepted: (kind: RecordKind, id: string, body: WriteBase & { date: string }) => post(`${recordPath(kind, id)}/accepted`, body),

  complete: (kind: RecordKind, id: string, stepKey: string, body: WriteBase) => post(`${stepPath(kind, id, stepKey)}/complete`, body),
  reopen: (kind: RecordKind, id: string, stepKey: string, body: ReasonBody) => post(`${stepPath(kind, id, stepKey)}/reopen`, body),
  skip: (kind: RecordKind, id: string, stepKey: string, body: WriteBase & { reason: string }) => post(`${stepPath(kind, id, stepKey)}/skip`, body),
  unskip: (kind: RecordKind, id: string, stepKey: string, body: WriteBase) => post(`${stepPath(kind, id, stepKey)}/unskip`, body),
  /** The unit's own deadline; `date: null` takes it back to the regulatory one. */
  due: (kind: RecordKind, id: string, stepKey: string, body: AdjustDueBody) => post(`${stepPath(kind, id, stepKey)}/due`, body),
  extend: (kind: RecordKind, id: string, stepKey: string, body: WriteBase & { reason: string }) => post(`${stepPath(kind, id, stepKey)}/extend`, body),

  /** Names the person who answers for a party of a step (`userId: null`: the heads of the unit again). */
  assignParty: (kind: RecordKind, id: string, stepKey: string, partyId: string, body: AssignPartyBody) =>
    post(`${stepPath(kind, id, stepKey)}/parties/${part(partyId)}/assignee`, body),
  candidates: (kind: RecordKind, id: string, stepKey: string, partyId: string) =>
    api.get<CandidateDto[]>(`${stepPath(kind, id, stepKey)}/parties/${part(partyId)}/candidates`).then(data),

  results: (kind: RecordKind, id: string, stepKey: string) => api.get<ResultsDto>(`${stepPath(kind, id, stepKey)}/results`).then(data),
  submitReport: (kind: RecordKind, id: string, stepKey: string, body: SubmitReportBody) => post(`${stepPath(kind, id, stepKey)}/reports`, body),
  editReport: (kind: RecordKind, id: string, stepKey: string, reportId: string, body: EditReportBody) =>
    post(`${stepPath(kind, id, stepKey)}/reports/${part(reportId)}/edit`, body),
  withdrawReport: (kind: RecordKind, id: string, stepKey: string, reportId: string, body: WriteBase) =>
    post(`${stepPath(kind, id, stepKey)}/reports/${part(reportId)}/withdraw`, body),
  addOpinion: (kind: RecordKind, id: string, stepKey: string, body: OpinionBody) => post(`${stepPath(kind, id, stepKey)}/opinions`, body),
  withdrawOpinion: (kind: RecordKind, id: string, stepKey: string, opinionId: string, body: WriteBase) =>
    post(`${stepPath(kind, id, stepKey)}/opinions/${part(opinionId)}/withdraw`, body),
  decide: (kind: RecordKind, id: string, stepKey: string, body: DecisionBody) => post(`${stepPath(kind, id, stepKey)}/decision`, body),
};
