import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CalendarEventsService } from './calendar-events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventScopeDto } from './dto/create-event.dto';

interface CurrentUser {
  id: string;
  role: string;
  teamIds?: string[];
  leaderTeamIds?: string[];
}

describe('CalendarEventsService', () => {
  let service: CalendarEventsService;
  let mockPrisma: any;

  const validCreateDto = {
    title: 'Họp giao ban',
    startDate: '2026-06-01',
    allDay: true,
    categoryId: 'cat-1',
    scope: EventScopeDto.PERSONAL,
  };

  const adminUser: CurrentUser = { id: 'admin-1', role: 'ADMIN' };
  const officerUser: CurrentUser = { id: 'user-1', role: 'OFFICER', teamIds: ['team-a'], leaderTeamIds: [] };
  const leaderUser: CurrentUser = { id: 'leader-1', role: 'OFFICER', teamIds: ['team-a'], leaderTeamIds: ['team-a'] };

  beforeEach(async () => {
    mockPrisma = {
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      userTeam: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      calendarEventOccurrenceOverride: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalendarEventsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<CalendarEventsService>(CalendarEventsService);
  });

  // ─── create() — scope rules ──────────────────────────────────────────────
  describe('create() — scope rules', () => {
    it('SYSTEM scope requires ADMIN role', async () => {
      await expect(
        service.create({ ...validCreateDto, scope: EventScopeDto.SYSTEM }, officerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SYSTEM scope succeeds for admin', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-1', scope: 'SYSTEM' });
      const result = await service.create(
        { ...validCreateDto, scope: EventScopeDto.SYSTEM, teamId: undefined },
        adminUser,
      );
      expect(result.id).toBe('ev-1');
      const callArgs = mockPrisma.calendarEvent.create.mock.calls[0][0];
      expect(callArgs.data.scope).toBe('SYSTEM');
      expect(callArgs.data.teamId).toBeNull();
      expect(callArgs.data.userId).toBeNull();
    });

    it('TEAM scope requires user is leader of the teamId or admin', async () => {
      await expect(
        service.create(
          { ...validCreateDto, scope: EventScopeDto.TEAM, teamId: 'team-a' },
          officerUser, // not a leader
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEAM scope succeeds for team leader', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-2', scope: 'TEAM' });
      await service.create(
        { ...validCreateDto, scope: EventScopeDto.TEAM, teamId: 'team-a' },
        leaderUser,
      );
      const callArgs = mockPrisma.calendarEvent.create.mock.calls[0][0];
      expect(callArgs.data.scope).toBe('TEAM');
      expect(callArgs.data.teamId).toBe('team-a');
    });

    it('TEAM scope succeeds for admin regardless of team membership', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-3', scope: 'TEAM' });
      await service.create(
        { ...validCreateDto, scope: EventScopeDto.TEAM, teamId: 'team-x' },
        adminUser,
      );
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalled();
    });

    it('PERSONAL scope FORCES userId = currentUser.id (ignores any client-sent userId)', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-4', scope: 'PERSONAL' });
      await service.create({ ...validCreateDto, scope: EventScopeDto.PERSONAL }, officerUser);
      const callArgs = mockPrisma.calendarEvent.create.mock.calls[0][0];
      expect(callArgs.data.userId).toBe('user-1');
      expect(callArgs.data.teamId).toBeNull();
    });
  });

  // ─── create() — per-user cap ─────────────────────────────────────────────
  describe('create() — per-user PERSONAL cap', () => {
    it('rejects when user already has >= 1000 active PERSONAL events', async () => {
      mockPrisma.calendarEvent.count.mockResolvedValue(1000);
      await expect(
        service.create({ ...validCreateDto, scope: EventScopeDto.PERSONAL }, officerUser),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.calendarEvent.create).not.toHaveBeenCalled();
    });

    it('does not check cap for SYSTEM or TEAM events', async () => {
      mockPrisma.calendarEvent.count.mockResolvedValue(99999);
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-sys' });
      await service.create({ ...validCreateDto, scope: EventScopeDto.SYSTEM }, adminUser);
      // No exception thrown
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalled();
    });
  });

  // ─── create() — recurrence safety ────────────────────────────────────────
  describe('create() — recurrence safety', () => {
    it('rejects FREQ=DAILY without recurrenceEndDate / UNTIL / COUNT', async () => {
      await expect(
        service.create(
          {
            ...validCreateDto,
            scope: EventScopeDto.PERSONAL,
            recurrenceRule: 'FREQ=DAILY',
            recurrenceEndDate: undefined,
          },
          officerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts FREQ=DAILY when recurrenceEndDate is provided', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-daily' });
      await service.create(
        {
          ...validCreateDto,
          scope: EventScopeDto.PERSONAL,
          recurrenceRule: 'FREQ=DAILY',
          recurrenceEndDate: '2026-12-31',
        },
        officerUser,
      );
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalled();
    });

    it('accepts FREQ=YEARLY unbounded (safe — max 1 occurrence/year)', async () => {
      mockPrisma.calendarEvent.create.mockResolvedValue({ id: 'ev-yearly' });
      await service.create(
        { ...validCreateDto, scope: EventScopeDto.PERSONAL, recurrenceRule: 'FREQ=YEARLY' },
        officerUser,
      );
      expect(mockPrisma.calendarEvent.create).toHaveBeenCalled();
    });
  });

  // ─── findInRange() — DataScope filtering ─────────────────────────────────
  describe('findInRange() — DataScope', () => {
    it('admin sees all events (scope filter not applied)', async () => {
      await service.findInRange(new Date('2026-01-01'), new Date('2026-12-31'), adminUser);
      const where = mockPrisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeNull();
      // No scope OR filter — admin gets everything
      expect(where.OR).toBeUndefined();
    });

    it('non-admin sees: SYSTEM events + own TEAM events + own PERSONAL events', async () => {
      await service.findInRange(new Date('2026-01-01'), new Date('2026-12-31'), officerUser);
      const where = mockPrisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { scope: 'SYSTEM' },
        { scope: 'TEAM', teamId: { in: ['team-a'] } },
        { scope: 'PERSONAL', userId: 'user-1' },
      ]);
    });

    it('user with empty teamIds still sees SYSTEM + PERSONAL', async () => {
      const userNoTeam: CurrentUser = { id: 'lone-1', role: 'OFFICER', teamIds: [] };
      await service.findInRange(new Date('2026-01-01'), new Date('2026-12-31'), userNoTeam);
      const where = mockPrisma.calendarEvent.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { scope: 'SYSTEM' },
        { scope: 'TEAM', teamId: { in: [] } },
        { scope: 'PERSONAL', userId: 'lone-1' },
      ]);
    });
  });

  // ─── update() — owner + scope rules ──────────────────────────────────────
  describe('update()', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { title: 'x' }, officerUser)).rejects.toThrow(NotFoundException);
    });

    it('SYSTEM event requires ADMIN role regardless of createdById', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev-sys',
        scope: 'SYSTEM',
        createdById: 'user-1', // user created when they were admin
        deletedAt: null,
      });
      await expect(
        service.update('ev-sys', { title: 'updated' }, officerUser), // no longer admin
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEAM event editable by team leader of the event team', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev-team',
        scope: 'TEAM',
        teamId: 'team-a',
        createdById: 'someone-else',
        deletedAt: null,
      });
      mockPrisma.calendarEvent.update.mockResolvedValue({ id: 'ev-team' });
      await service.update('ev-team', { title: 'updated' }, leaderUser);
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalled();
    });

    it('PERSONAL event editable by owner only', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev-personal',
        scope: 'PERSONAL',
        userId: 'user-1',
        createdById: 'user-1',
        deletedAt: null,
      });
      mockPrisma.calendarEvent.update.mockResolvedValue({ id: 'ev-personal' });
      await service.update('ev-personal', { title: 'updated' }, officerUser);
      expect(mockPrisma.calendarEvent.update).toHaveBeenCalled();
    });

    it('PERSONAL event NOT editable by another user', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev-personal-other',
        scope: 'PERSONAL',
        userId: 'someone-else',
        createdById: 'someone-else',
        deletedAt: null,
      });
      await expect(
        service.update('ev-personal-other', { title: 'updated' }, officerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('records updatedById = currentUser.id', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev',
        scope: 'PERSONAL',
        userId: 'user-1',
        createdById: 'user-1',
        deletedAt: null,
      });
      mockPrisma.calendarEvent.update.mockResolvedValue({ id: 'ev' });
      await service.update('ev', { title: 'updated' }, officerUser);
      const data = mockPrisma.calendarEvent.update.mock.calls[0][0].data;
      expect(data.updatedById).toBe('user-1');
      expect(data.title).toBe('updated');
    });
  });

  // ─── softDelete() ─────────────────────────────────────────────────────────
  describe('softDelete()', () => {
    it('throws NotFoundException when event does not exist', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('nope', officerUser)).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt on the parent event when deleting whole series', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev',
        scope: 'PERSONAL',
        userId: 'user-1',
        createdById: 'user-1',
        deletedAt: null,
      });
      mockPrisma.calendarEvent.update.mockResolvedValue({ id: 'ev', deletedAt: new Date() });
      await service.softDelete('ev', officerUser);
      const data = mockPrisma.calendarEvent.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
    });

    it('PERSONAL event NOT deletable by another user', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev',
        scope: 'PERSONAL',
        userId: 'someone-else',
        createdById: 'someone-else',
        deletedAt: null,
      });
      await expect(service.softDelete('ev', officerUser)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── excludeOccurrence() — delete 1 occurrence of recurring series ──────
  describe('excludeOccurrence()', () => {
    it('creates an override row with excluded=true for the specific date', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev',
        scope: 'PERSONAL',
        userId: 'user-1',
        createdById: 'user-1',
        recurrenceRule: 'FREQ=WEEKLY',
        deletedAt: null,
      });
      mockPrisma.calendarEventOccurrenceOverride.create.mockResolvedValue({
        id: 'ov-1',
        eventId: 'ev',
        occurrenceDate: new Date('2026-06-15'),
        excluded: true,
      });

      await service.excludeOccurrence('ev', '2026-06-15', officerUser);

      const callArgs = mockPrisma.calendarEventOccurrenceOverride.create.mock.calls[0][0];
      expect(callArgs.data.eventId).toBe('ev');
      expect(callArgs.data.excluded).toBe(true);
    });

    it('refuses to exclude an occurrence of a non-recurring event', async () => {
      mockPrisma.calendarEvent.findUnique.mockResolvedValue({
        id: 'ev',
        scope: 'PERSONAL',
        userId: 'user-1',
        createdById: 'user-1',
        recurrenceRule: null, // non-recurring
        deletedAt: null,
      });

      await expect(service.excludeOccurrence('ev', '2026-06-15', officerUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── findInRange() — basic (PR 1 compat) ─────────────────────────────────
  describe('findInRange() — basic include category', () => {
    it('returns empty array when no events', async () => {
      const result = await service.findInRange(new Date('2030-01-01'), new Date('2030-12-31'), officerUser);
      expect(result).toEqual([]);
    });

    it('includes category relation', async () => {
      await service.findInRange(new Date('2026-01-01'), new Date('2026-01-31'), officerUser);
      const include = mockPrisma.calendarEvent.findMany.mock.calls[0][0].include;
      expect(include.category).toBe(true);
    });
  });

  // ─── expandOccurrences() — RRULE expansion (PR 2 core) ───────────────────
  describe('expandOccurrences()', () => {
    it('non-recurring event yields exactly 1 occurrence on its startDate', () => {
      const events = [
        {
          id: 'ev1',
          title: 'One-off',
          startDate: new Date('2026-06-15T00:00:00.000Z'),
          recurrenceRule: null,
          recurrenceEndDate: null,
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2026-06-01'), new Date('2026-06-30'));
      expect(result).toHaveLength(1);
      expect(result[0].occurrenceDate.toISOString().slice(0, 10)).toBe('2026-06-15');
      expect(result[0].eventId).toBe('ev1');
    });

    it('non-recurring event outside range yields 0 occurrences', () => {
      const events = [
        {
          id: 'ev1',
          startDate: new Date('2026-06-15T00:00:00.000Z'),
          recurrenceRule: null,
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2027-01-01'), new Date('2027-12-31'));
      expect(result).toHaveLength(0);
    });

    it('FREQ=YEARLY annual event yields 1 occurrence per year', () => {
      const events = [
        {
          id: 'ev1',
          title: 'Sinh nhật CAND 19/8',
          startDate: new Date('2026-08-19T00:00:00.000Z'),
          recurrenceRule: 'FREQ=YEARLY',
          recurrenceEndDate: null,
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2027-01-01'), new Date('2030-12-31'));
      const dates = result.map((r) => r.occurrenceDate.toISOString().slice(0, 10));
      expect(dates).toEqual(['2027-08-19', '2028-08-19', '2029-08-19', '2030-08-19']);
    });

    it('FREQ=WEEKLY yields one occurrence per week within the range', () => {
      const events = [
        {
          id: 'ev1',
          startDate: new Date('2026-06-01T00:00:00.000Z'), // Monday
          recurrenceRule: 'FREQ=WEEKLY',
          recurrenceEndDate: null,
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2026-06-01'), new Date('2026-06-28'));
      expect(result).toHaveLength(4);
    });

    it('respects recurrenceEndDate — no occurrences after the end', () => {
      const events = [
        {
          id: 'ev1',
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          recurrenceRule: 'FREQ=DAILY',
          recurrenceEndDate: new Date('2026-06-05T00:00:00.000Z'),
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2026-06-01'), new Date('2026-06-10'));
      const dates = result.map((r) => r.occurrenceDate.toISOString().slice(0, 10));
      expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']);
    });

    it('applies excluded=true overrides (EXDATE) — skip that occurrence', () => {
      const events = [
        {
          id: 'ev1',
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          recurrenceRule: 'FREQ=DAILY',
          recurrenceEndDate: new Date('2026-06-05T00:00:00.000Z'),
          overrides: [
            { occurrenceDate: new Date('2026-06-03T00:00:00.000Z'), excluded: true, overrideFields: null },
          ],
        },
      ];
      const result = service.expandOccurrences(events as any, new Date('2026-06-01'), new Date('2026-06-10'));
      const dates = result.map((r) => r.occurrenceDate.toISOString().slice(0, 10));
      expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05']);
    });

    it('hard cap at 500 occurrences per event (DoS protection)', () => {
      const events = [
        {
          id: 'evil',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          recurrenceRule: 'FREQ=DAILY',
          // recurrenceEndDate=null wouldn't normally reach service (DTO guards it),
          // but defense-in-depth: even if it does, cap at 500.
          recurrenceEndDate: new Date('2030-12-31T00:00:00.000Z'),
          overrides: [],
        },
      ];
      const result = service.expandOccurrences(
        events as any,
        new Date('2026-01-01'),
        new Date('2030-12-31'),
      );
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });
});
