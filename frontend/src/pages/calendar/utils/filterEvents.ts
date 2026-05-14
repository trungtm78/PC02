import type { CalendarEvent, EventScopeFE } from '../CalendarPage';

export type KindFilter = 'all' | 'lich' | 'sukien';
export type ScopeFilterValue = EventScopeFE | 'LEGACY';

/**
 * Apply 3-level filtering to events shown on /calendar:
 *
 *   1. Kind: 'all' (no restrict) | 'lich' (recurring system) | 'sukien' (work events)
 *      - Lịch = type='holiday' OR (type='event' AND scope='SYSTEM')
 *      - Sự kiện = type IN (deadline/hearing/meeting/other) OR
 *                   (type='event' AND scope IN TEAM/PERSONAL)
 *
 *   2. Scope: existing behavior — 'LEGACY' covers all non-event types,
 *      SYSTEM/TEAM/PERSONAL filter type='event'.
 *
 *   3. Category: only applies when event has categorySlug. Legacy types
 *      bypass (no categorySlug → not filtered out).
 *
 * Heuristic confirmed via plan-mode AUQ 2026-05-14.
 */
export function filterEvents(
  events: CalendarEvent[],
  kindFilter: KindFilter,
  scopeFilter: Set<ScopeFilterValue>,
  categoryFilter: Set<string>,
): CalendarEvent[] {
  return events.filter((e) => {
    // 1. Kind filter
    if (kindFilter === 'lich') {
      const isLich = e.type === 'holiday' || (e.type === 'event' && e.scope === 'SYSTEM');
      if (!isLich) return false;
    } else if (kindFilter === 'sukien') {
      const isSuKien =
        e.type === 'deadline' ||
        e.type === 'hearing' ||
        e.type === 'meeting' ||
        e.type === 'other' ||
        (e.type === 'event' && e.scope !== 'SYSTEM');
      if (!isSuKien) return false;
    }

    // 2. Scope filter (existing semantic — preserved)
    if (e.type === 'event' && e.scope) {
      if (!scopeFilter.has(e.scope)) return false;
    } else if (e.type !== 'event') {
      if (!scopeFilter.has('LEGACY')) return false;
    }

    // 3. Category filter — only applies when event has categorySlug
    if (e.categorySlug && !categoryFilter.has(e.categorySlug)) {
      return false;
    }

    return true;
  });
}
