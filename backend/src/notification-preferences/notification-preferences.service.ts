import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const ALL_PREF_TYPES: NotificationType[] = [
  NotificationType.CASE_ASSIGNED,
  NotificationType.CASE_STATUS_CHANGED,
  NotificationType.PETITION_ASSIGNED,
  NotificationType.PETITION_RECEIVED,
  NotificationType.INCIDENT_ASSIGNED,
  NotificationType.INCIDENT_CREATED,
  NotificationType.UTDT_ASSIGNED,
];

const DEFAULT_PREF = { inApp: true, push: true };

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const savedMap = new Map(saved.map((p) => [p.eventType, p]));

    const data = ALL_PREF_TYPES.map((type) => {
      const record = savedMap.get(type);
      return {
        eventType: type,
        inApp: record?.inApp ?? DEFAULT_PREF.inApp,
        push: record?.push ?? DEFAULT_PREF.push,
      };
    });

    return { success: true, data };
  }

  async upsertPreference(
    userId: string,
    eventType: NotificationType,
    dto: { inApp: boolean; push: boolean },
  ) {
    const record = await this.prisma.notificationPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: { userId, eventType, inApp: dto.inApp, push: dto.push },
      update: { inApp: dto.inApp, push: dto.push },
    });
    return { success: true, data: record };
  }

  async resetPreferences(userId: string) {
    await this.prisma.notificationPreference.deleteMany({ where: { userId } });
    return { success: true };
  }
}
