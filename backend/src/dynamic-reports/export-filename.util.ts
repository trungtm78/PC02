/**
 * R18 — shared by every xlsx export in this module (`AggregateService`'s
 * manager workbook, `SubmissionService.exportOwnSubmission`'s editor
 * sheet, …). Factored out of `aggregate.service.ts` so a second export
 * site doesn't have to import across `submission.service.ts` ↔
 * `aggregate.service.ts` (which already import from each other for
 * `SubmissionError`) and risk a module cycle.
 */

/** Excel sheet names: ≤31 chars, no `* ? : \ / [ ]`. */
export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[*?:\\/[\]]/g, ' ').trim();
  return (cleaned || 'To').slice(0, 31);
}

/** File names: ASCII/Vietnamese letters, digits, dashes only. */
export function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9À-ỹ\- ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned.slice(0, 60) || 'bao-cao';
}
