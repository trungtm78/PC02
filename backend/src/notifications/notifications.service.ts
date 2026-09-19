import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── GET LIST ────────────────────────────────────────────────────────────
  async getList(userId: string, query: QueryNotificationsDto) {
    const { unreadOnly, limit = 20, offset = 0 } = query;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      success: true,
      data,
      total,
      unreadCount,
      limit,
      offset,
    };
  }

  // ── GET UNREAD COUNT ─────────────────────────────────────────────────────
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { success: true, unreadCount: count };
  }

  // ── MARK ONE AS READ ─────────────────────────────────────────────────────
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      return { success: false, message: 'Notification not found' };
    }
    // D10: always set acknowledgedAt + clear pushNextRetryAt, regardless of isRead state.
    // Clicking the notification link = user acknowledged the assignment.
    // Removing the early-return prevents infinite push retries when notification
    // was read via dropdown (isRead=true) but never clicked (acknowledgedAt never set).
    const now = new Date();
    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: (notification as Record<string, unknown>).readAt as Date | null ?? now,
        acknowledgedAt: (notification as Record<string, unknown>).acknowledgedAt as Date | null ?? now,
        pushNextRetryAt: null,
      },
    });
    return { success: true, data: updated };
  }

  // ── MARK ALL AS READ ─────────────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date(), acknowledgedAt: new Date(), pushNextRetryAt: null },
    });
    return { success: true, updatedCount: result.count };
  }

  // ── DELETE ONE ───────────────────────────────────────────────────────────
  async deleteOne(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      return { success: false, message: 'Notification not found' };
    }
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  // ── DELETE ALL READ ──────────────────────────────────────────────────────
  async deleteAllRead(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });
    return { success: true, deletedCount: result.count };
  }

  // ── CREATE (internal use — called by other services) ─────────────────────
  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        link: dto.link,
        metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });
    return notification;
  }
}
