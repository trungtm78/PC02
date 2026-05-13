import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'deadline' | 'hearing' | 'meeting' | 'other' | 'holiday' | 'event';
  description?: string;
  caseId?: string;
  incidentId?: string;
  petitionId?: string;
  holidayCategory?: 'NATIONAL' | 'POLICE' | 'MILITARY' | 'INTERNATIONAL' | 'OTHER';
  isOfficialDayOff?: boolean;
  // PR 1 dual-read fields (only set when type === 'event')
  categorySlug?: string;
  categoryName?: string;
  categoryColor?: string;
  scope?: 'SYSTEM' | 'TEAM' | 'PERSONAL';
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarEventsService: CalendarEventsService,
  ) {}

  // GET /api/v1/calendar/events?year=&month=
  async getEvents(year?: number, month?: number): Promise<{ success: boolean; data: CalendarEvent[] }> {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month; // undefined = whole year

    let fromDate: Date;
    let toDate: Date;

    if (targetMonth !== undefined) {
      fromDate = new Date(targetYear, targetMonth - 1, 1);
      toDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    } else {
      fromDate = new Date(targetYear, 0, 1);
      toDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    }

    // PR 3: Holiday table removed — 25 holiday rows migrated to CalendarEvent
    // with scope=SYSTEM. Only query 3 deadline sources + the unified calendar_events.
    const [cases, incidents, petitions, calendarEvents] = await Promise.all([
      this.prisma.case.findMany({
        where: {
          deletedAt: null,
          deadline: { gte: fromDate, lte: toDate },
        },
        select: { id: true, name: true, deadline: true, status: true },
      }),
      this.prisma.incident.findMany({
        where: {
          deletedAt: null,
          deadline: { gte: fromDate, lte: toDate },
        },
        select: { id: true, name: true, deadline: true, status: true },
      }),
      this.prisma.petition.findMany({
        where: {
          deletedAt: null,
          deadline: { gte: fromDate, lte: toDate },
        },
        select: { id: true, stt: true, summary: true, deadline: true, status: true },
      }),
      // Fetch events whose startDate <= toDate AND (recurrenceEndDate IS NULL
      // OR >= fromDate) to catch recurring series starting before the window.
      this.prisma.calendarEvent.findMany({
        where: {
          deletedAt: null,
          startDate: { lte: toDate },
          OR: [
            { recurrenceEndDate: null },
            { recurrenceEndDate: { gte: fromDate } },
          ],
        },
        include: { category: true, overrides: true },
      }),
    ]);

    const events: CalendarEvent[] = [];

    for (const c of cases) {
      if (!c.deadline) continue;
      events.push({
        id: `case-${c.id}`,
        title: `[Vụ án] ${c.name}`,
        date: c.deadline.toISOString().slice(0, 10),
        type: 'deadline',
        description: `Hạn xử lý vụ án: ${c.name}`,
        caseId: c.id,
      });
    }

    for (const i of incidents) {
      if (!i.deadline) continue;
      events.push({
        id: `incident-${i.id}`,
        title: `[Vụ việc] ${i.name}`,
        date: i.deadline.toISOString().slice(0, 10),
        type: 'deadline',
        description: `Hạn xử lý vụ việc: ${i.name}`,
        incidentId: i.id,
      });
    }

    for (const p of petitions) {
      if (!p.deadline) continue;
      events.push({
        id: `petition-${p.id}`,
        title: `[Đơn thư] ${p.summary ?? p.stt}`,
        date: p.deadline.toISOString().slice(0, 10),
        type: 'deadline',
        description: `Hạn xử lý đơn thư: ${p.stt}`,
        petitionId: p.id,
      });
    }

    // PR 3: Holiday table dropped. All 25 holiday entries now live in calendar_events
    // with scope=SYSTEM and surface through expandOccurrences() below with type='event'.

    // Recurring expansion. Expand into per-date occurrences, applying EXDATE
    // overrides. Non-recurring events yield 1 occurrence each.
    const expanded = this.calendarEventsService.expandOccurrences(calendarEvents, fromDate, toDate);
    for (const occ of expanded) {
      const ev = occ.event;
      events.push({
        id: `event-${ev.id}-${occ.occurrenceDate.toISOString().slice(0, 10)}`,
        title: ev.shortTitle ?? ev.title,
        date: occ.occurrenceDate.toISOString().slice(0, 10),
        type: 'event',
        description: ev.description ?? undefined,
        isOfficialDayOff: ev.isOfficialDayOff,
        categorySlug: ev.category?.slug,
        categoryName: ev.category?.name,
        categoryColor: ev.category?.color,
        scope: ev.scope,
      });
    }

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: events };
  }
}
