import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RRule, rrulestr } from 'rrule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { EmailService } from '../email/email.service';
import { CreateReminderDto, ReminderChannelDto } from './dto/create-reminder.dto';

/**
 * Cron window — only fire for occurrences whose start time falls within this many
 * minutes ahead of "now" (after adjusting for minutesBefore). Eng review tightened
 * from 1 hour to 6 minutes to reduce duplicate INSERT failures when cron overlaps.
 */
const DISPATCH_WINDOW_MINUTES = 6;
const PRUNE_RETENTION_DAYS = 90;

@Injectable()
export class EventRemindersService {
  private readonly logger = new Logger(EventRemindersService.name);
  /** In-process mutex — protects against overlapping cron ticks (Eng fix #2). */
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly email: EmailService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async listForEvent(eventId: string, userId: string) {
    return this.prisma.eventReminder.findMany({
      where: { eventId, userId },
      orderBy: { minutesBefore: 'asc' },
    });
  }

  async create(eventId: string, dto: CreateReminderDto, userId: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event || event.deletedAt) {
      throw new NotFoundException(`Sự kiện ${eventId} không tồn tại`);
    }

    // Reject duplicate — same user can't have 2 reminders at the same minutesBefore.
    const existing = await this.prisma.eventReminder.findFirst({
      where: { eventId, userId, minutesBefore: dto.minutesBefore },
    });
    if (existing) {
      throw new ConflictException(
        `Bạn đã có nhắc nhở ${dto.minutesBefore} phút trước cho sự kiện này`,
      );
    }

    return this.prisma.eventReminder.create({
      data: {
        eventId,
        userId,
        minutesBefore: dto.minutesBefore,
        channels: dto.channels as any,
      },
    });
  }

  async remove(eventId: string, reminderId: string, userId: string) {
    const reminder = await this.prisma.eventReminder.findUnique({ where: { id: reminderId } });
    if (!reminder) {
      throw new NotFoundException(`Nhắc nhở ${reminderId} không tồn tại`);
    }
    if (reminder.userId !== userId) {
      throw new ForbiddenException('Bạn chỉ xóa được nhắc nhở của chính mình');
    }
    return this.prisma.eventReminder.delete({ where: { id: reminderId } });
  }

  // ─── Cron dispatcher ─────────────────────────────────────────────────────

  /**
   * Reminder dispatcher — fires every 5 minutes. In-process mutex skips overlapping
   * ticks (e.g. when FCM is slow). Window is 6 minutes (slightly longer than cron
   * interval to catch boundary cases).
   *
   * Per-occurrence idempotency: insert EventReminderDispatch row BEFORE sending —
   * UNIQUE(reminderId, occurrenceDate) catches duplicate attempts atomically.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runDispatcher(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous dispatcher run still in flight — skipping this tick');
      return;
    }
    this.running = true;
    try {
      await this.doDispatch();
    } catch (err) {
      this.logger.error('Dispatcher failed', err);
    } finally {
      this.running = false;
    }
  }

  private async doDispatch(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + DISPATCH_WINDOW_MINUTES * 60 * 1000);

    // Load all active reminders with their event + user. Filter in JS — simpler
    // than computing occurrence dates in SQL with RRULE.
    const reminders = await this.prisma.eventReminder.findMany({
      include: {
        event: { include: { overrides: true } },
        user: { select: { id: true, email: true } },
      },
    });

    let dispatched = 0;
    for (const reminder of reminders) {
      const ev = reminder.event;
      if (!ev || ev.deletedAt) continue;

      // Compute all occurrence dates that need a reminder firing within this window.
      // For non-recurring: just 1 occurrence on ev.startDate.
      // For recurring: expand via rrule.between() across a lookback window wide
      // enough to catch any occurrence whose `start - minutesBefore` falls in [now, windowEnd].
      const occurrenceDates = this.computeOccurrencesInWindow(ev, reminder.minutesBefore, now, windowEnd);

      for (const occurrenceDate of occurrenceDates) {
        // Atomic claim: insert dispatch row first. UNIQUE(reminderId, occurrenceDate)
        // catches duplicate from an earlier overlapping cron tick.
        try {
          await this.prisma.eventReminderDispatch.create({
            data: {
              reminderId: reminder.id,
              occurrenceDate,
              channels: reminder.channels as any,
            },
          });
        } catch (err: any) {
          if (err?.code === 'P2002') {
            // Another cron tick already claimed this dispatch — skip silently.
            continue;
          }
          this.logger.warn(`Failed to claim dispatch for reminder ${reminder.id}: ${err?.message}`);
          continue;
        }

        // Send via configured channels. Each send wrapped to never break the loop.
        const channels = reminder.channels as unknown as ReminderChannelDto[];

        if (channels.includes(ReminderChannelDto.FCM)) {
          try {
            await this.push.sendToUser(reminder.userId, {
              title: `Nhắc nhở: ${ev.title}`,
              body: ev.shortTitle ?? ev.title,
              data: {
                eventId: ev.id,
                occurrenceDate: occurrenceDate.toISOString().slice(0, 10),
              },
            });
          } catch (err: any) {
            this.logger.warn(`FCM send failed for reminder ${reminder.id}: ${err?.message}`);
          }
        }

        if (channels.includes(ReminderChannelDto.EMAIL) && reminder.user?.email) {
          try {
            await this.email.sendEventReminder(reminder.user.email, ev.title, occurrenceDate);
          } catch (err: any) {
            this.logger.warn(`Email send failed for reminder ${reminder.id}: ${err?.message}`);
          }
        }

        dispatched++;
      }
    }

    if (dispatched > 0) {
      this.logger.log(`Dispatcher fired ${dispatched} reminder(s)`);
    }
  }

  /**
   * Return occurrence dates whose `start - minutesBefore` falls in [now, windowEnd].
   * For recurring events: expand via rrule.between(), filter overrides (EXDATE).
   * Hard-capped at 100 occurrences/event/window to keep the cron loop fast.
   */
  private computeOccurrencesInWindow(
    event: any,
    minutesBefore: number,
    now: Date,
    windowEnd: Date,
  ): Date[] {
    const result: Date[] = [];
    const overrideMap = new Map<string, any>();
    for (const ov of event.overrides ?? []) {
      overrideMap.set(ov.occurrenceDate.toISOString().slice(0, 10), ov);
    }

    // Convert the (now, windowEnd) trigger range to event-start range.
    // trigger = start - minutesBefore → start = trigger + minutesBefore.
    // Tolerance: -60s on lower bound — rrule returns minute-aligned times while
    // `now` includes sub-second ms, so an event exactly at "now + minutesBefore"
    // would otherwise fall under startRangeFrom by milliseconds. The dispatch
    // table's UNIQUE constraint prevents double-firing.
    const startRangeFrom = new Date(now.getTime() + minutesBefore * 60 * 1000 - 60 * 1000);
    const startRangeTo = new Date(windowEnd.getTime() + minutesBefore * 60 * 1000);

    if (!event.recurrenceRule) {
      // Non-recurring: single occurrence at combined date+time.
      const eventStart = this.combineDateTime(event.startDate, event.startTime);
      if (eventStart >= startRangeFrom && eventStart <= startRangeTo) {
        // Check override.
        const key = event.startDate.toISOString().slice(0, 10);
        if (!overrideMap.get(key)?.excluded) {
          result.push(event.startDate);
        }
      }
      return result;
    }

    // Recurring: rrule expands from DTSTART. Use rrulestr() with explicit dtstart
    // option — avoids iCalendar string TZ parsing. Search ±7 days around the
    // trigger window — post-filter on occStart enforces correctness.
    try {
      const ruleWithStart = rrulestr(`RRULE:${event.recurrenceRule}`, {
        dtstart: event.startDate,
      }) as RRule;
      const searchFrom = new Date(startRangeFrom.getTime() - 7 * 24 * 60 * 60 * 1000);
      const searchTo = event.recurrenceEndDate && event.recurrenceEndDate < startRangeTo
        ? event.recurrenceEndDate
        : new Date(startRangeTo.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dates = ruleWithStart.between(searchFrom, searchTo, true).slice(0, 100);
      for (const date of dates) {
        // Apply event time-of-day to get true occurrence start.
        const occStart = this.combineDateTime(date, event.startTime);
        if (occStart >= startRangeFrom && occStart <= startRangeTo) {
          const key = date.toISOString().slice(0, 10);
          if (overrideMap.get(key)?.excluded) continue;
          // Date-only for UNIQUE key on EventReminderDispatch.
          const dateOnly = new Date(date);
          dateOnly.setHours(0, 0, 0, 0);
          result.push(dateOnly);
        }
      }
    } catch (err: any) {
      this.logger.warn(`RRULE parse failed for event ${event.id}: ${err?.message}`);
    }
    return result;
  }

  private toRRuleDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Daily 02:00 cron — prunes dispatch rows older than 90 days.
   * Without this, the table grows unbounded (~78k rows/year for 200 users).
   */
  @Cron('0 2 * * *')
  async prune(): Promise<number> {
    const cutoff = new Date(Date.now() - PRUNE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.eventReminderDispatch.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`Pruned ${result.count} dispatch rows older than ${PRUNE_RETENTION_DAYS} days`);
    }
    return result.count;
  }

  private combineDateTime(date: Date, time: string | null): Date {
    if (!time) return date;
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined;
  }
}
