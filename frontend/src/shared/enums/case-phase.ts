/**
 * UI-only phase labels used by the legacy classification screens
 * (`InitialCasesPage`, `OtherClassificationPage`, `WardCasesPage`,
 * `WardIncidentsPage`). These match the values seeded into the API
 * response's `status` field for those endpoints.
 *
 * Distinct from `CaseStatus` / `IncidentStatus` (Prisma) — those are the
 * BLTTHS workflow statuses. The labels here are the older filter chips.
 */
export const CASE_PHASE = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  RESOLVED: 'resolved',
  OVERDUE: 'overdue',
  INVESTIGATING: 'investigating',
} as const;

export type CasePhase = (typeof CASE_PHASE)[keyof typeof CASE_PHASE];
