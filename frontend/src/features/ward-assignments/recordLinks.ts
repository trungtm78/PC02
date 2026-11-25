import type { MatchSource } from './api/alerts';

/** Where each kind of record opens in full (from a match: in a new tab, the review stays where it is). */
export const RECORD_LINK: Record<MatchSource, (id: string) => string> = {
  WARD_ASSIGNMENT: (id) => `/ho-so-phan-cong/${encodeURIComponent(id)}`,
  PETITION: (id) => `/petitions/${encodeURIComponent(id)}`,
  CASE: (id) => `/cases/${encodeURIComponent(id)}`,
  INCIDENT: (id) => `/incidents/${encodeURIComponent(id)}`,
};
