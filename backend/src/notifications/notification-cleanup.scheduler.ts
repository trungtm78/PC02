import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationCleanupScheduler {
  private readonly logger = new Logger(NotificationCleanupScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * 0') // Sunday 03:00 UTC (10:00 VN)
  async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        isRead: true,
        acknowledgedAt: { not: null },
      },
    });
    if (count > 0) this.logger.log(`Cleaned up ${count} old notifications`);
  }
}
