import { api } from '@/lib/api';

/** Lane D of the contract (ward-contract.md): subject matching, deadline alert, statistics. */

export type AlertLevel = 'NONE' | 'YELLOW' | 'RED' | 'OVERDUE' | 'DONE';
export const ALERT_LEVELS: readonly AlertLevel[] = ['NONE', 'YELLOW', 'RED', 'OVERDUE', 'DONE'];

export interface WardAlert {
  level: AlertLevel | string;
  dueOn: string | null;
  daysLeft: number | null;
}

export type MatchSource = 'WARD_ASSIGNMENT' | 'PETITION' | 'INCIDENT' | 'CASE';

export interface SubjectMatch {
  subjectPosition: number;
  level: 'CERTAIN' | 'POSSIBLE';
  source: MatchSource;
  recordId: string;
  code: string | null;
  unitName?: string | null;
  name: string;
  concludedSame?: boolean;
}

export interface MatchConclusionBody {
  subjectPosition: number;
  otherSource: MatchSource;
  otherRecordId: string;
  samePerson: boolean;
}

export interface WardStatsQuery {
  from?: string;
  to?: string;
  teamId?: string;
  crimeId?: string;
  caseType?: 'INCIDENT' | 'CASE';
}

export interface WardStatsCards {
  total: number;
  new: number;
  reassign: number;
  pending: number;
  returned: number;
  overdue: number;
  onTimeRate: number | null;
  avgSubmissions: number | null;
  firstPassRate: number | null;
  avgReviewDays?: number | null;
}

export interface WardStatsUnitRow {
  teamId: string;
  name: string;
  total: number;
  new: number;
  reassign: number;
  pending: number;
  returned: number;
  overdue: number;
  onTimeRate: number | null;
  avgSubmissions: number | null;
  firstPassRate?: number | null;
  avgReviewDays: number | null;
}

export interface WardStats {
  cards: WardStatsCards;
  byMonth: { month: string; new: number; reassign: number }[];
  byUnit: WardStatsUnitRow[];
  byCrime: { crimeId: string | null; name: string | null; total: number; new: number; reassign: number }[];
}

const data = <T>(r: { data: T }): T => r.data;
const part = (s: string): string => encodeURIComponent(s);
const BASE = '/ward-assignments';

/** Only the filters given: an empty value is not sent (the server reads a missing filter as "all"). */
function params(query: WardStatsQuery): Record<string, string> {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => typeof v === 'string' && v !== '')) as Record<string, string>;
}

export const wardAlertsApi = {
  subjectMatches: (assignmentId: string) => api.get<SubjectMatch[]>(`${BASE}/${part(assignmentId)}/subject-matches`).then(data),
  conclude: (assignmentId: string, body: MatchConclusionBody) => api.post(`${BASE}/${part(assignmentId)}/subject-matches/conclusions`, body).then(data),
  stats: (query: WardStatsQuery) => api.get<WardStats>(`${BASE}/stats`, { params: params(query) }).then(data),
};

/** The list route of the requests (lane B), filtered: what a number of the statistics opens. */
export const WARD_LIST_PATH = '/ho-so-phan-cong';
export function wardListLink(filters: {
  submitted?: 'true';
  from?: string;
  to?: string;
  teamId?: string | null;
  status?: string;
  alert?: AlertLevel;
  crimeId?: string | null;
  caseType?: string;
  kind?: 'NEW' | 'REASSIGN';
}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (typeof value === 'string' && value !== '') search.set(key, value);
  const text = search.toString();
  return text ? `${WARD_LIST_PATH}?${text}` : WARD_LIST_PATH;
}
