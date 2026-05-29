/**
 * v0.47 PR6 — Track B Import Part 2 commit constants.
 *
 * Centralised so audit + tests + service share the same source of truth.
 */

/** Dual-confirm: 2 different admin approvals must land within this window. */
export const DUAL_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Max preview rows per sheet in the dry-run payload (UI snapshot). */
export const DRYRUN_SAMPLE_ROWS_PER_SHEET = 5;

/** Source tag written to Case/Incident.importedFrom on commit. */
export const IMPORT_SOURCE_TAG = 'xlsx-phu-luc';

/** Default provenance for Case rows materialised from import (BLTTHS Đ.143). */
export const IMPORT_DEFAULT_CASE_PROVENANCE = 'TRANSFERRED';

/** Status state machine for XlsxImportLog. */
export const XLSX_IMPORT_STATUS = {
  PARSED: 'PARSED',
  PENDING_SECOND_CONFIRM: 'PENDING_SECOND_CONFIRM',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
} as const;
export type XlsxImportStatus = (typeof XLSX_IMPORT_STATUS)[keyof typeof XLSX_IMPORT_STATUS];
