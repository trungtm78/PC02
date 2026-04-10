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
    if (notification.isRead) {
      return { success: true, data: notification };
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true, data: updated };
  }

  // ── MARK ALL AS READ ─────────────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
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

  // ── SEED DEMO NOTIFICATIONS (for initial testing) ────────────────────────
  async seedDemoForUser(userId: string) {
    const existing = await this.prisma.notification.count({ where: { userId } });
    if (existing > 0) return { seeded: false };

    const demos = [
      {
        userId,
        type: NotificationType.CASE_STATUS_CHANGED,
        title: 'Vụ án cập nhật trạng thái',
        message: 'Vụ án VA-2026-001 đã chuyển sang trạng thái "Đang điều tra".',
        link: '/cases',
      },
      {
        userId,
        type: NotificationType.CASE_DEADLINE_NEAR,
        title: 'Vụ án sắp đến hạn',
        message: 'Vụ án VA-2026-002 sẽ đến hạn xử lý trong 3 ngày nữa.',
        link: '/cases',
      },
      {
        userId,
        type: NotificationType.PETITION_RECEIVED,
        title: 'Đơn thư mới tiếp nhận',
        message: 'Đã tiếp nhận đơn tố cáo mới từ công dân Nguyễn Văn A.',
        link: '/petitions',
      },
      {
        userId,
        type: NotificationType.DOCUMENT_UPLOADED,
        title: 'Tài liệu vụ án được cập nhật',
        message: 'Biên bản lấy lời khai đã được tải lên vụ án VA-2026-003.',
        link: '/cases',
      },
      {
        userId,
        type: NotificationType.SYSTEM,
        title: 'Chào mừng đến hệ thống PC02',
        message: 'Hệ thống Quản lý Vụ án PC02 đã sẵn sàng phục vụ.',
        link: '/dashboard',
      },
    ];

    await this.prisma.notification.createMany({ data: demos });
    return { seeded: true, count: demos.length };
  }
}
