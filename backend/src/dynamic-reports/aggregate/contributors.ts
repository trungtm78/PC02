import type { Contribution } from '../engine/aggregate';

/**
 * Who is in a field's total, and who owes it: the ONE place that decides.
 *
 * Two different questions, kept apart on purpose:
 * - `contributing`: is this team's figure added into the total of this field under the mode being looked at;
 * - `obligated`: must this team report this field at all (the denominator of completeness).
 * A team may own only a subset of the report's fields (`ownedFieldKeys`); a field it does not own is neither in its
 * contribution (not even as a zero) nor in what it owes.
 */
export type SummaryMode = 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';

/** Which submission states put a team's figures in the totals under each mode (D03). */
export const CONTRIBUTING_STATES: Record<SummaryMode, readonly string[]> = {
  SUBMITTED: ['SUBMITTED', 'APPROVED'],
  APPROVED: ['APPROVED'],
  ALL_SAVED: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
};

/** The least an assignment row must carry to be asked these questions. */
export interface ContributorRow {
  id?: string;
  obligation: string;
  /** The fields this team reports. null / undefined = every field (all reports made before subsets existed). */
  ownedFieldKeys?: unknown;
  submission?: { state: string; values?: unknown } | null;
}

/** The subset as a list, or null when the team owns every field. Anything that is not a list of keys means "no subset". */
export function ownedKeys(row: Pick<ContributorRow, 'ownedFieldKeys'>): readonly string[] | null {
  const raw = row.ownedFieldKeys;
  return Array.isArray(raw) ? (raw as unknown[]).filter((k): k is string => typeof k === 'string') : null;
}

export function owns(row: Pick<ContributorRow, 'ownedFieldKeys'>, fieldKey: string): boolean {
  const keys = ownedKeys(row);
  return keys === null || keys.includes(fieldKey);
}

export function obligated(row: ContributorRow, fieldKey: string): boolean {
  return row.obligation !== 'EXEMPT' && owns(row, fieldKey);
}

/** A team in a state that counts under the mode, whatever the field: the team-level half of `contributing`. */
export function countsUnder(row: ContributorRow, mode: SummaryMode): boolean {
  return row.obligation !== 'EXEMPT' && CONTRIBUTING_STATES[mode].includes(row.submission?.state ?? 'NOT_STARTED');
}

export function contributing(row: ContributorRow, fieldKey: string, mode: SummaryMode): boolean {
  return countsUnder(row, mode) && owns(row, fieldKey);
}

function valueOf(row: ContributorRow, fieldKey: string): string | null {
  const values = (row.submission?.values ?? {}) as Record<string, { v: string | null } | undefined>;
  return values[fieldKey]?.v ?? null;
}

/** Per field: the assignments whose figure counts, each with the value it brings (null = left blank). */
export function contributorsFor<T extends ContributorRow>(
  rows: readonly T[],
  fieldKey: string,
  mode: SummaryMode,
): { assignment: T; value: string | null }[] {
  return rows
    .filter((row) => contributing(row, fieldKey, mode))
    .map((row) => ({ assignment: row, value: valueOf(row, fieldKey) }));
}

/** The same list in the shape the aggregate engine takes. */
export function contributionsFor(rows: readonly ContributorRow[], fieldKey: string, mode: SummaryMode): Contribution[] {
  return contributorsFor(rows, fieldKey, mode).map(({ assignment, value }, i) => ({
    sourceId: assignment.id ?? String(i),
    value,
  }));
}

/**
 * What identifies "the set a file was made from": the teams, and for a team with a subset also WHICH fields it brings,
 * so a changed subset invalidates an older file. With no subset anywhere the result is exactly the sorted team ids it
 * always was (files made before subsets keep matching). Subsets are kept as structured entries, never joined into one
 * string: a field key may itself contain a comma.
 */
export function contributorSetIdentity(
  rows: readonly (Pick<ContributorRow, 'ownedFieldKeys'> & { teamId: string })[],
): unknown[] {
  if (!rows.some((row) => ownedKeys(row) !== null)) return rows.map((row) => row.teamId).sort();
  return rows
    .map((row) => {
      const keys = ownedKeys(row);
      return [row.teamId, keys === null ? null : [...keys].sort()] as [string, string[] | null];
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** The code a subset names a field by: its stable item key, or its field key when it has none (template reports). */
export const itemKeyOf = (field: { fieldKey: string; itemKey?: string | null }): string =>
  field.itemKey ?? field.fieldKey;

/**
 * Freezes a target's subset (item keys) into the field keys of ONE version, for the assignment of a period being made.
 * null in = null out (the team owns everything). A key the version does not have is dropped: it names a criterion that
 * a newer version removed.
 */
export function freezeOwnedFieldKeys(
  itemKeys: unknown,
  fields: readonly { fieldKey: string; itemKey?: string | null }[],
): string[] | null {
  if (!Array.isArray(itemKeys)) return null;
  const wanted = new Set((itemKeys as unknown[]).filter((k): k is string => typeof k === 'string'));
  return fields.filter((f) => wanted.has(itemKeyOf(f))).map((f) => f.fieldKey);
}

/** The fields of a version that this team reports, in the version's order. */
export function ownedFieldsOf<F extends { fieldKey: string }>(
  row: Pick<ContributorRow, 'ownedFieldKeys'>,
  fields: readonly F[],
): F[] {
  return fields.filter((f) => owns(row, f.fieldKey));
}
