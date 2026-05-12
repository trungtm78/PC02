import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'deadline' | 'hearing' | 'meeting' | 'other' | 'holiday';
  description?: string;
  caseId?: string;
  incidentId?: string;
  petitionId?: string;
  holidayCategory?: 'NATIONAL' | 'POLICE' | 'MILITARY' | 'INTERNATIONAL' | 'OTHER';
  isOfficialDayOff?: boolean;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [cases, incidents, petitions, holidays] = await Promise.all([
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
      this.prisma.holiday.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        select: {
          id: true,
          title: true,
          shortTitle: true,
          date: true,
          category: true,
          isOfficialDayOff: true,
          description: true,
        },
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

    for (const h of holidays) {
      events.push({
        id: `holiday-${h.id}`,
        title: h.shortTitle ?? h.title,
        date: h.date.toISOString().slice(0, 10),
        type: 'holiday',
        description: h.description ?? h.title,
        holidayCategory: h.category,
        isOfficialDayOff: h.isOfficialDayOff,
      });
    }

    // Sort by date ascending
    events.sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: events };
  }
}
