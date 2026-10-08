import { Optional } from '@nestjs/common';
import { CaseNotificationPolicyService } from './case-notification-policy.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { nextRetryTime } from './work-hours.util';

@Injectable()
export class NotificationPushScheduler {
  private readonly logger = new Logger(NotificationPushScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    @Optional() private readonly casePolicy?: CaseNotificationPolicyService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runDispatcher(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.dispatch();
    } finally {
      this.running = false;
    }
  }

  private async dispatch(): Promise<void> {
    const now = new Date();

    // D2: removed pushRetryCount < pushMaxRetries (Prisma cannot do field-to-field comparison).
    // pushNextRetryAt=null already marks exhausted retries.
    const pending = await this.prisma.notification.findMany({
      where: {
        pushNextRetryAt: { lte: now },
        acknowledgedAt: null,
      },
      take: 100,
    });

    for (const original of pending) {
      const policy =
        this.casePolicy ?? new CaseNotificationPolicyService(this.prisma);
      const notif = await policy.serialize(original.userId, original);
      if (!notif) {
        await this.prisma.notification.update({
          where: { id: original.id },
          data: { pushNextRetryAt: null },
        });
        continue;
      }
      try {
        await this.push.sendToUser(notif.userId, {
          title: notif.title,
          body: notif.message,
          data: {
            type: notif.type,
            notificationId: notif.id,
            link: notif.link ?? '/',
          },
        });

        const newCount = notif.pushRetryCount + 1;
        const hasMore = newCount < notif.pushMaxRetries;

        await this.prisma.notification.update({
          where: { id: notif.id },
          data: {
            pushSentAt: now,
            pushRetryCount: newCount,
            pushNextRetryAt: hasMore ? nextRetryTime(newCount) : null,
          },
        });
      } catch (err) {
        this.logger.error(`Push failed for notification ${notif.id}`, err);
        const newCount = notif.pushRetryCount + 1;
        const hasMore = newCount < notif.pushMaxRetries;
        await this.prisma.notification.update({
          where: { id: notif.id },
          data: {
            pushRetryCount: newCount,
            pushNextRetryAt: hasMore ? nextRetryTime(newCount) : null,
          },
        });
      }
    }
  }
}
