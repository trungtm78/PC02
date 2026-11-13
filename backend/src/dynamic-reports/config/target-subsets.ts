import { itemKeyOf } from '../aggregate/contributors';

/** Why a team's subset of criteria was refused; the screen translates the code. */
export type TargetSubsetErrorCode = 'TARGET_SUBSET_EMPTY' | 'TARGET_ITEM_KEY_UNKNOWN';

export class TargetSubsetError extends Error {
  constructor(
    public readonly code: TargetSubsetErrorCode,
    public readonly teamId: string,
    public readonly unknown: string[] = [],
  ) {
    super(code);
  }
}

/** Thrown when two input cells claim to be the same criterion: a subset naming it would then cover both. */
export class DuplicateItemKeyError extends Error {
  constructor(public readonly itemKey: string) {
    super('CRITERIA_KEY_DUPLICATE');
  }
}

/** Every item key names exactly one field of the version (a key may equally not collide with another field's key). */
export function assertUniqueItemKeys(fields: readonly { fieldKey: string; itemKey?: string | null }[]): void {
  const seen = new Set<string>();
  for (const field of fields) {
    const key = itemKeyOf(field);
    if (seen.has(key)) throw new DuplicateItemKeyError(key);
    seen.add(key);
  }
}

/**
 * The subset as it is stored: undefined / null = the team reports every criterion (stored as SQL NULL); otherwise the
 * de-duplicated keys in the order of the report's fields, so two equal subsets are stored identically.
 *
 * Refused: an empty subset (a team that must report but owes nothing is a contradiction: leave the team out instead),
 * and a key the report does not have (a typo would otherwise silently shrink what the team reports).
 */
export function normaliseTargetSubset(
  teamId: string,
  itemKeys: readonly string[] | null | undefined,
  fields: readonly { fieldKey: string; itemKey?: string | null }[],
): string[] | null {
  if (itemKeys === null || itemKeys === undefined) return null;
  const known = fields.map(itemKeyOf);
  const wanted = new Set(itemKeys);
  if (wanted.size === 0) throw new TargetSubsetError('TARGET_SUBSET_EMPTY', teamId);
  const unknown = [...wanted].filter((k) => !known.includes(k));
  if (unknown.length > 0) throw new TargetSubsetError('TARGET_ITEM_KEY_UNKNOWN', teamId, unknown);
  // Every criterion picked is the same as no subset at all: store it as "all", so a criterion added by a later
  // version is the team's too (the default the owner asked for).
  if (known.every((k) => wanted.has(k))) return null;
  return known.filter((k) => wanted.has(k));
}
