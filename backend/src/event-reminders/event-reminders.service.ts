import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PR 1 skeleton: list reminders for an event owned by the current user.
   * PR 2 will add create/delete + cron dispatcher (mutex, FCM/email).
   */
  async listForEvent(eventId: string, userId: string) {
    return this.prisma.eventReminder.findMany({
      where: { eventId, userId },
      orderBy: { minutesBefore: 'asc' },
    });
  }
}
