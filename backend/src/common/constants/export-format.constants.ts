/**
 * Report export format — accepted as `?format=` query parameter.
 *
 * `excel` produces an `.xlsx` via ExcelJS. Anything else falls back to JSON.
 */
export const EXPORT_FORMAT = {
  EXCEL: 'excel',
  JSON: 'json',
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];
