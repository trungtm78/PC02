/**
 * Helpers for seed-admin-units.ts.
 *
 * Extracted as pure functions for unit testing.
 */

/**
 * Returns IDs of DB rows whose `code` is NOT present in the new dataset code set.
 *
 * Used to detect orphan WARDs and PROVINCEs after a snapshot import:
 * rows still active in DB but absent from the imported dataset version
 * (e.g., units consolidated by cải cách hành chính).
 *
 * Caller marks returned IDs as isActive=false / abolishedAt=now.
 */
export function findOrphanIds<T extends { id: string; code: string }>(
  dbRows: T[],
  datasetCodes: Set<string>,
): string[] {
  return dbRows.filter((r) => !datasetCodes.has(r.code)).map((r) => r.id);
}
