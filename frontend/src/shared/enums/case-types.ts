/**
 * Record categories used as filter values across Proposal, Exchange, and
 * Workflow pages. These are display-derived strings (Vietnamese labels) used
 * directly as discriminators because no backend enum mirrors them — the
 * Proposal/Exchange schema stores them in a free-form `caseType: String?`
 * field. Treat as a closed set; do not introduce new values without also
 * updating the backend `caseType` writer.
 */
export const CASE_TYPE = {
  CASE: 'Vụ án',
  INCIDENT: 'Vụ việc',
  PETITION: 'Đơn thư',
} as const;

export type CaseType = (typeof CASE_TYPE)[keyof typeof CASE_TYPE];
