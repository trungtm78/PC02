/** Pure helpers for override rows (a team's, or a person's own) and for comparing configuration documents. */
import { allowedReaches } from './matrix';
import type { CatalogueIndex } from './labels';
import { AUDIENCE, EFFECT, REACH, TEAM_MODE, type Override, type Reach, type TeamConfig, type TeamOverride } from './types';

export const emptyOverride = (): Override => ({ permission: '', effect: EFFECT.GRANT, reach: null, reason: '', expiresAt: null });
export const emptyTeamOverride = (): TeamOverride => ({ ...emptyOverride(), audience: AUDIENCE.ALL });
export const emptyTeamConfig = (): TeamConfig => ({ mode: TEAM_MODE.INHERIT, memberTemplateId: null, leaderTemplateId: null, overrides: [] });

/** How far a grant of this permission may reach; a permission the catalogue does not know allows only ALL. */
export function reachChoices(index: CatalogueIndex, permission: string): readonly Reach[] {
  const info = index.get(permission);
  return info ? allowedReaches(info.resource) : [REACH.ALL];
}

/**
 * A row after one of its fields changed, kept consistent: "Tắt quyền" has no reach; a grant whose reach the new
 * permission does not allow falls back to the only one it has (all-or-nothing permissions) or to "not chosen yet".
 */
export function normaliseOverride<T extends Override>(index: CatalogueIndex, row: T): T {
  if (row.effect === EFFECT.MUTE) return { ...row, reach: null };
  const choices = reachChoices(index, row.permission);
  if (row.reach && choices.includes(row.reach)) return row;
  return { ...row, reach: row.permission && choices.length === 1 ? choices[0] : null };
}

/** What is sent: reasons trimmed, nothing else touched (the server says what is wrong with a row). */
export function cleanOverrides<T extends Override>(rows: readonly T[]): T[] {
  return rows.map((row) => ({ ...row, reason: row.reason.trim() }));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO date-time -> the `yyyy-mm-dd` of a date input, in the browser's own time zone. */
export function dateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `yyyy-mm-dd` -> the END of that day as ISO (an override "until the 30th" still holds on the 30th); empty = no end. */
export function expiryFromDateInput(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Documents are compared as values: key order and override order do not make a difference (as on the server). */
export function canonical(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys).map((x) => JSON.stringify(x)).sort();
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, sortKeys(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(sortKeys(value));
}
export const sameDoc = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
