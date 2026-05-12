import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

      // Compute the trigger time for each occurrence within the window.
      // For non-recurring events: 1 occurrence on startDate. For recurring: skip
      // (PR 2b cron handles non-recurring only — recurring expansion + dispatcher
      // is deferred to a follow-up because it requires RRULE iteration server-side
      // which adds latency to the cron loop. Acceptable tradeoff: recurring events
      // still display on calendar, just don't send reminders. Plan documents this.)
      if (ev.recurrenceRule) continue;

      // Trigger time = event start - minutesBefore.
      const eventStart = this.combineDateTime(ev.startDate, ev.startTime);
      const triggerTime = new Date(eventStart.getTime() - reminder.minutesBefore * 60 * 1000);

      if (triggerTime < now || triggerTime > windowEnd) continue;

      // Atomic claim: insert dispatch row first. UNIQUE catches duplicate from
      // an earlier overlapping cron tick.
      try {
        await this.prisma.eventReminderDispatch.create({
          data: {
            reminderId: reminder.id,
            occurrenceDate: ev.startDate,
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
              occurrenceDate: ev.startDate.toISOString().slice(0, 10),
            },
          });
        } catch (err: any) {
          this.logger.warn(`FCM send failed for reminder ${reminder.id}: ${err?.message}`);
        }
      }

      if (channels.includes(ReminderChannelDto.EMAIL) && reminder.user?.email) {
        try {
          await this.email.sendEventReminder(reminder.user.email, ev.title, ev.startDate);
        } catch (err: any) {
          this.logger.warn(`Email send failed for reminder ${reminder.id}: ${err?.message}`);
        }
      }

      dispatched++;
    }

    if (dispatched > 0) {
      this.logger.log(`Dispatcher fired ${dispatched} reminder(s)`);
    }
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
