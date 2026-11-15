/** What the backlog screen keeps outside its component: its keys in the address, its query keys, and its period. */
import { today } from '@/lib/dates';
import type { BacklogCell, BacklogFilters, OnTimeQuery, UnappliedCell } from './types';

/** The prefix of every key this screen keeps in the address: `backlog_kind`, `backlog_role`, `backlog_from`, ... */
export const BACKLOG_URL_PREFIX = 'backlog';
/** The rows of one page of a cell: the server's own default. */
export const BACKLOG_PAGE_SIZE = 20;

export const BACKLOG_QUERY_KEYS = {
  units: (filters: BacklogFilters, rolledUp: boolean) => ['processing-backlog', 'units', filters, rolledUp] as const,
  cell: (filters: BacklogFilters, cell: BacklogCell | null, page: number, asOf: string) =>
    ['processing-backlog', 'cell', filters, cell, page, asOf] as const,
  unapplied: (cell: UnappliedCell | null, page: number, asOf: string) => ['processing-backlog', 'unapplied', cell, page, asOf] as const,
  onTime: (query: OnTimeQuery) => ['processing-backlog', 'on-time', query] as const,
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day of the address (`YYYY-MM-DD`), or `null` for anything else: a mistyped link must not reach the server. */
export const dayParam = (value: string | null): string | null => (value !== null && DAY.test(value) ? value : null);

/** The civil month `day` (a `YYYY-MM-DD` in Vietnam time) falls in, first day to last. */
export function monthOf(day: string = today()): { from: string; to: string } {
  const [year, month] = day.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const head = day.slice(0, 8);
  return { from: `${head}01`, to: `${head}${String(last).padStart(2, '0')}` };
}
