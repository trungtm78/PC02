import type { RecordKind } from './types';

export const RECORD_QUERY_KEYS = {
  /** The flow of one record: both tabs read it, every write puts the answer straight into it. */
  flow: (kind: RecordKind, id: string) => ['processing-record', 'flow', kind, id] as const,
  /** The books (reports and opinions) of every step of one record. */
  allResults: (kind: RecordKind, id: string) => ['processing-record', 'results', kind, id] as const,
  results: (kind: RecordKind, id: string, stepKey: string) => ['processing-record', 'results', kind, id, stepKey] as const,
  /** The people who may be named on one party of one step. */
  candidates: (kind: RecordKind, id: string, stepKey: string, partyId: string) => ['processing-record', 'candidates', kind, id, stepKey, partyId] as const,
};
