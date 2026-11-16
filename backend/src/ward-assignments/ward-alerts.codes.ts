/**
 * Error codes of the matching, alert and statistics routes of ward assignment requests. The server sends the code,
 * the screen translates it (`frontend/src/locales/wardAssignmentAlerts.vi.ts`). Never renamed without the screen.
 */
export const WARD_ALERT_ERROR = {
  /** The subject position is not one of the request's subjects. */
  SUBJECT_NOT_FOUND: 'WARD_MATCH_SUBJECT_NOT_FOUND',
  /** The pair concluded on is not a match the person can see now. */
  MATCH_NOT_FOUND: 'WARD_MATCH_NOT_FOUND',
  /** The conclusion needs `samePerson` (true or false). */
  CONCLUSION_INVALID: 'WARD_MATCH_CONCLUSION_INVALID',
  /** A period bound that is not a calendar day (`YYYY-MM-DD`), or `from` after `to`. */
  STATS_RANGE_INVALID: 'WARD_STATS_RANGE_INVALID',
} as const;

export const WARD_ALERT_AUDIT = {
  MATCH_CONCLUDED: 'WARD_ASSIGNMENT_MATCH_CONCLUDED',
} as const;
