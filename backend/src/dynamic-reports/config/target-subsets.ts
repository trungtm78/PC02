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
