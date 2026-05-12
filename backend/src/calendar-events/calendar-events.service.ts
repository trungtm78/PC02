import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PR 1 skeleton: read non-deleted events in a date range with category included.
   * PR 2 will add scope filtering, recurrence expansion, owner/team/permission checks.
   */
  async findInRange(from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: {
        deletedAt: null,
        startDate: { gte: from, lte: to },
      },
      include: { category: true },
    });
  }
}
