import { describe, it, expect } from 'vitest';
import { filterEvents } from '../filterEvents';
import type { CalendarEvent } from '../../CalendarPage';

/**
 * filterEvents pure function — owns the "Lịch vs Sự kiện" classification logic
 * for /calendar (v0.21.7.0). Tested in isolation so CalendarPage component
 * tests don't have to drive state through chip clicks.
 *
 * Heuristic confirmed via plan-mode AUQ:
 *   Lịch = type='holiday' OR (type='event' AND scope='SYSTEM')
 *   Sự kiện = type IN (deadline|hearing|meeting|other) OR (type='event' AND scope IN TEAM/PERSONAL)
 */

const makeHoliday = (id: string): CalendarEvent => ({
  id,
  title: `Holiday ${id}`,
  date: '2026-05-01',
  type: 'holiday',
});

const makeSystemEvent = (id: string, categorySlug = 'national'): CalendarEvent => ({
  id: `event-${id}-2026-05-19`,
  title: `System event ${id}`,
  date: '2026-05-19',
  type: 'event',
  scope: 'SYSTEM',
  categorySlug,
});

const makeTeamEvent = (id: string, categorySlug = 'other'): CalendarEvent => ({
  id: `event-${id}-2026-05-20`,
  title: `Team event ${id}`,
  date: '2026-05-20',
  type: 'event',
  scope: 'TEAM',
  categorySlug,
});

const makeDeadline = (id: string): CalendarEvent => ({
  id: `case-${id}`,
  title: `Hạn vụ án ${id}`,
  date: '2026-05-25',
  type: 'deadline',
});

const ALL_SCOPES = new Set<'LEGACY' | 'SYSTEM' | 'TEAM' | 'PERSONAL'>([
  'LEGACY',
  'SYSTEM',
  'TEAM',
  'PERSONAL',
]);
const ALL_CATEGORIES = new Set<string>([
  'national',
  'police',
  'military',
  'international',
  'other',
]);

describe('filterEvents', () => {
  describe('kindFilter=all (default)', () => {
    it('returns all events when no filter restricts them', () => {
      const events = [makeHoliday('h1'), makeSystemEvent('s1'), makeDeadline('d1')];
      const result = filterEvents(events, 'all', ALL_SCOPES, ALL_CATEGORIES);
      expect(result).toHaveLength(3);
    });
  });

  describe('kindFilter=lich', () => {
    it('keeps holiday events', () => {
      const events = [makeHoliday('h1')];
      const result = filterEvents(events, 'lich', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['h1']);
    });

    it('keeps type=event with scope=SYSTEM (recurring system events)', () => {
      const events = [makeSystemEvent('sys-1')];
      const result = filterEvents(events, 'lich', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['event-sys-1-2026-05-19']);
    });

    it('drops TEAM scope events from Lịch view', () => {
      const events = [makeSystemEvent('sys'), makeTeamEvent('team')];
      const result = filterEvents(events, 'lich', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['event-sys-2026-05-19']);
    });

    it('drops deadline/hearing/meeting events from Lịch view', () => {
      const events = [makeHoliday('h'), makeDeadline('d')];
      const result = filterEvents(events, 'lich', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['h']);
    });
  });

  describe('kindFilter=sukien', () => {
    it('keeps deadline events', () => {
      const events = [makeDeadline('d1')];
      const result = filterEvents(events, 'sukien', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['case-d1']);
    });

    it('keeps type=event with scope=TEAM', () => {
      const events = [makeTeamEvent('team')];
      const result = filterEvents(events, 'sukien', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['event-team-2026-05-20']);
    });

    it('drops holiday events from Sự kiện view', () => {
      const events = [makeHoliday('h'), makeDeadline('d')];
      const result = filterEvents(events, 'sukien', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['case-d']);
    });

    it('drops SYSTEM-scope events from Sự kiện view', () => {
      const events = [makeSystemEvent('sys'), makeTeamEvent('team')];
      const result = filterEvents(events, 'sukien', ALL_SCOPES, ALL_CATEGORIES);
      expect(result.map((e) => e.id)).toEqual(['event-team-2026-05-20']);
    });
  });

  describe('categoryFilter', () => {
    it('keeps only events whose categorySlug is in the filter', () => {
      const events = [
        makeSystemEvent('a', 'national'),
        makeSystemEvent('b', 'police'),
        makeSystemEvent('c', 'military'),
      ];
      const result = filterEvents(
        events,
        'all',
        ALL_SCOPES,
        new Set(['police']),
      );
      expect(result.map((e) => e.title)).toEqual(['System event b']);
    });

    it('bypasses category filter for events without categorySlug (legacy types)', () => {
      // Deadline events don't have categorySlug → should pass through regardless
      // of which categories are checked.
      const events = [makeDeadline('d'), makeSystemEvent('s', 'national')];
      const result = filterEvents(events, 'all', ALL_SCOPES, new Set(['police']));
      // Deadline 'd' kept (no categorySlug, bypasses), system 's' dropped (national not in filter)
      expect(result.map((e) => e.id)).toEqual(['case-d']);
    });
  });

  describe('combined filters', () => {
    it('applies kindFilter + categoryFilter together', () => {
      const events = [
        makeSystemEvent('police-evt', 'police'),
        makeSystemEvent('mil-evt', 'military'),
        makeTeamEvent('team-evt', 'police'),
        makeDeadline('d'),
      ];
      // Lịch + only police category → drops mil-evt (military), drops team-evt (TEAM scope), drops d (deadline)
      const result = filterEvents(
        events,
        'lich',
        ALL_SCOPES,
        new Set(['police']),
      );
      expect(result.map((e) => e.id)).toEqual(['event-police-evt-2026-05-19']);
    });
  });
});
