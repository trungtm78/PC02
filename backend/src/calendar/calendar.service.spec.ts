/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/**
 * CalendarService Unit Tests
 *
 * getEvents:
 *   - returns { success: true, data } shape
 *   - filters deadlines within given year/month range
 *   - events from all three sources (case, incident, petition)
 *   - skips records with null deadline
 *   - sorts events ascending by date
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = {
  case: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  incident: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  petition: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  calendarEvent: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCase(id: string, deadline: Date) {
  return { id, name: `Vụ án ${id}`, deadline, status: 'DANG_DIEU_TRA' };
}

function makeIncident(id: string, deadline: Date) {
  return { id, name: `Vụ việc ${id}`, deadline, status: 'DANG_XAC_MINH' };
}

function makePetition(id: string, deadline: Date) {
  return { id, stt: `DT-2026-${id}`, summary: `Đơn thư ${id}`, deadline, status: 'DANG_XU_LY' };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        CalendarEventsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    jest.clearAllMocks();
    mockPrisma.case.findMany.mockResolvedValue([]);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.petition.findMany.mockResolvedValue([]);
    mockPrisma.calendarEvent.findMany.mockResolvedValue([]);
  });

  // ── getEvents ──────────────────────────────────────────────────────────────

  describe('getEvents', () => {
    it('returns { success: true, data: [] } when no records have deadlines', async () => {
      const result = await service.getEvents(2026, 1);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('maps a case deadline to a CalendarEvent with correct shape and caseId', async () => {
      const deadline = new Date('2026-03-15T00:00:00.000Z');
      mockPrisma.case.findMany.mockResolvedValue([makeCase('c1', deadline)]);

      const result = await service.getEvents(2026, 3);
      expect(result.data).toHaveLength(1);

      const ev = result.data[0];
      expect(ev.id).toBe('case-c1');
      expect(ev.type).toBe('deadline');
      expect(ev.date).toBe('2026-03-15');
      expect(ev.caseId).toBe('c1');
      expect(ev).toHaveProperty('title');
      expect(ev).toHaveProperty('description');
    });

    it('maps incident and petition deadlines to CalendarEvents with correct ids', async () => {
      const deadline = new Date('2026-05-10T00:00:00.000Z');
      mockPrisma.incident.findMany.mockResolvedValue([makeIncident('i1', deadline)]);
      mockPrisma.petition.findMany.mockResolvedValue([makePetition('p1', deadline)]);

      const result = await service.getEvents(2026, 5);
      const ids = result.data.map((e) => e.id);
      expect(ids).toContain('incident-i1');
      expect(ids).toContain('petition-p1');

      const incidentEv = result.data.find((e) => e.id === 'incident-i1')!;
      expect(incidentEv.incidentId).toBe('i1');

      const petitionEv = result.data.find((e) => e.id === 'petition-p1')!;
      expect(petitionEv.petitionId).toBe('p1');
    });

    it('skips cases with null deadline (no event emitted)', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        { id: 'c-null', name: 'No deadline', deadline: null, status: 'TIEP_NHAN' },
        makeCase('c-ok', new Date('2026-04-20T00:00:00.000Z')),
      ]);

      const result = await service.getEvents(2026, 4);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('case-c-ok');
    });

    it('sorts events ascending by date', async () => {
      mockPrisma.case.findMany.mockResolvedValue([
        makeCase('c-late', new Date('2026-06-30T00:00:00.000Z')),
        makeCase('c-early', new Date('2026-06-01T00:00:00.000Z')),
        makeCase('c-mid', new Date('2026-06-15T00:00:00.000Z')),
      ]);

      const result = await service.getEvents(2026, 6);
      expect(result.data[0].date).toBe('2026-06-01');
      expect(result.data[1].date).toBe('2026-06-15');
      expect(result.data[2].date).toBe('2026-06-30');
    });

    it('queries Prisma with year-only range when month is not provided', async () => {
      await service.getEvents(2026);

      const caseCall = mockPrisma.case.findMany.mock.calls[0][0];
      // From 2026-01-01 to 2026-12-31
      expect(caseCall.where.deadline.gte.getFullYear()).toBe(2026);
      expect(caseCall.where.deadline.gte.getMonth()).toBe(0); // January
    });

    // ── PR 3: Holiday table dropped. CalendarEvent is the only source. ──
    describe('calendar events (PR 3 — Holiday dropped)', () => {
      it('queries calendarEvent and surfaces events with type=event', async () => {
        const date = new Date('2026-02-21T00:00:00.000Z');
        mockPrisma.calendarEvent.findMany.mockResolvedValue([
          {
            id: 'ev1',
            title: 'Sự kiện mới',
            shortTitle: null,
            description: null,
            startDate: date,
            recurrenceRule: null,
            recurrenceEndDate: null,
            isOfficialDayOff: false,
            scope: 'SYSTEM',
            deletedAt: null,
            category: { slug: 'police', name: 'Ngành Công an', color: '#1e40af' },
            overrides: [],
          },
        ]);

        const result = await service.getEvents(2026, 2);

        const ids = result.data.map((e) => e.id);
        expect(ids.some((id) => id.startsWith('event-ev1'))).toBe(true);
        expect(mockPrisma.calendarEvent.findMany).toHaveBeenCalled();
      });

      it('filters soft-deleted calendar events (deletedAt is null)', async () => {
        await service.getEvents(2026, 2);
        const callArgs = mockPrisma.calendarEvent.findMany.mock.calls[0][0];
        expect(callArgs.where.deletedAt).toBeNull();
      });

      it('queries calendarEvent within window with recurring-aware filter (PR 2)', async () => {
        await service.getEvents(2026, 3);
        const calendarCall = mockPrisma.calendarEvent.findMany.mock.calls[0][0];
        // PR 2: where uses startDate.lte + OR on recurrenceEndDate to catch recurring series.
        expect(calendarCall.where.startDate.lte.getFullYear()).toBe(2026);
        expect(calendarCall.where.OR).toEqual([
          { recurrenceEndDate: null },
          { recurrenceEndDate: { gte: expect.any(Date) } },
        ]);
      });

      it('maps a CalendarEvent into the CalendarEvent output shape with type=event', async () => {
        const date = new Date('2026-08-19T00:00:00.000Z');
        mockPrisma.calendarEvent.findMany.mockResolvedValue([
          {
            id: 'ev-cand-80',
            title: 'Kỷ niệm 80 năm CAND',
            shortTitle: 'CAND 80',
            description: 'Lễ kỷ niệm toàn ngành',
            startDate: date,
            recurrenceRule: null,
            recurrenceEndDate: null,
            overrides: [],
            isOfficialDayOff: false,
            scope: 'SYSTEM',
            deletedAt: null,
            category: { slug: 'police', name: 'Ngành Công an', color: '#1e40af' },
          },
        ]);

        const result = await service.getEvents(2026, 8);
        // PR 2: id format = event-{eventId}-{YYYY-MM-DD}
        const ev = result.data.find((e) => e.id === 'event-ev-cand-80-2026-08-19');
        expect(ev).toBeDefined();
        expect(ev!.type).toBe('event');
        expect(ev!.date).toBe('2026-08-19');
        expect(ev!.title).toBe('CAND 80'); // shortTitle preferred
        expect(ev!.description).toBe('Lễ kỷ niệm toàn ngành');
      });
    });
  });
});
