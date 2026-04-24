import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addDays, subHours } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const TERMINAL_CASE_STATUSES = ['DINH_CHI', 'TAM_DINH_CHI', 'KHONG_KHOI_TO'] as const;
const TERMINAL_INCIDENT_STATUSES = ['TAM_DINH_CHI', 'KET_THUC'] as const;
const TERMINAL_PETITION_STATUSES = ['DA_GIAI_QUYET', 'KHONG_GIAI_QUYET', 'CHUYEN_DON'] as const;

@Injectable()
export class DeadlineScheduler {
  private readonly logger = new Logger(DeadlineScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  @Cron('0 7 * * *')
  async checkDeadlines() {
    this.logger.log('DeadlineScheduler: running deadline check');
    const today = new Date();

    const thresholdSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'CANH_BAO_SAP_HAN' },
    });
    const warnDays = parseInt(thresholdSetting?.value ?? '7', 10);
    const inWarnDays = addDays(today, warnDays);

    await Promise.allSettled([
      this.checkCases(today, inWarnDays),
      this.checkIncidents(today, inWarnDays),
      this.checkPetitions(today, inWarnDays),
    ]);

    this.logger.log('DeadlineScheduler: done');
  }

  private async checkCases(today: Date, inWarnDays: Date) {
    const overdue = await this.prisma.case.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_CASE_STATUSES as unknown as string[] },
        deletedAt: null,
        investigatorId: { not: null },
      },
      select: { id: true, name: true, investigatorId: true },
    });

    for (const c of overdue) {
      if (await this.isDuped('case', c.id, c.investigatorId!)) continue;
      await this.pushService.sendToUser(c.investigatorId!, {
        title: 'Vụ án quá hạn',
        body: `${c.name} đã quá hạn giải quyết`,
        data: { type: 'case_overdue', id: c.id, link: `/cases/${c.id}` },
      });
      await this.markNotified('case', c.id, c.investigatorId!);
    }

    const near = await this.prisma.case.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_CASE_STATUSES as unknown as string[] },
        deletedAt: null,
        investigatorId: { not: null },
      },
      select: { id: true, name: true, investigatorId: true },
    });

    for (const c of near) {
      if (await this.isDuped('case_near', c.id, c.investigatorId!)) continue;
      await this.pushService.sendToUser(c.investigatorId!, {
        title: 'Vụ án sắp đến hạn',
        body: `${c.name} sắp đến hạn giải quyết`,
        data: { type: 'case_near_deadline', id: c.id, link: `/cases/${c.id}` },
      });
      await this.markNotified('case_near', c.id, c.investigatorId!);
    }
  }

  private async checkIncidents(today: Date, inWarnDays: Date) {
    const overdue = await this.prisma.incident.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_INCIDENT_STATUSES as unknown as string[] },
        deletedAt: null,
        investigatorId: { not: null },
      },
      select: { id: true, name: true, investigatorId: true },
    });

    for (const inc of overdue) {
      if (await this.isDuped('incident', inc.id, inc.investigatorId!)) continue;
      await this.pushService.sendToUser(inc.investigatorId!, {
        title: 'Vụ việc quá hạn',
        body: `${inc.name} đã quá hạn xử lý`,
        data: { type: 'incident_overdue', id: inc.id, link: `/incidents/${inc.id}` },
      });
      await this.markNotified('incident', inc.id, inc.investigatorId!);
    }

    const near = await this.prisma.incident.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_INCIDENT_STATUSES as unknown as string[] },
        deletedAt: null,
        investigatorId: { not: null },
      },
      select: { id: true, name: true, investigatorId: true },
    });

    for (const inc of near) {
      if (await this.isDuped('incident_near', inc.id, inc.investigatorId!)) continue;
      await this.pushService.sendToUser(inc.investigatorId!, {
        title: 'Vụ việc sắp đến hạn',
        body: `${inc.name} sắp đến hạn xử lý`,
        data: { type: 'incident_near_deadline', id: inc.id, link: `/incidents/${inc.id}` },
      });
      await this.markNotified('incident_near', inc.id, inc.investigatorId!);
    }
  }

  private async checkPetitions(today: Date, inWarnDays: Date) {
    const overdue = await this.prisma.petition.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_PETITION_STATUSES as unknown as string[] },
        deletedAt: null,
        assignedToId: { not: null },
      },
      select: { id: true, senderName: true, assignedToId: true },
    });

    for (const p of overdue) {
      if (await this.isDuped('petition', p.id, p.assignedToId!)) continue;
      await this.pushService.sendToUser(p.assignedToId!, {
        title: 'Đơn thư quá hạn',
        body: `Đơn của ${p.senderName} đã quá hạn xử lý`,
        data: { type: 'petition_overdue', id: p.id, link: `/petitions/${p.id}` },
      });
      await this.markNotified('petition', p.id, p.assignedToId!);
    }

    const near = await this.prisma.petition.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_PETITION_STATUSES as unknown as string[] },
        deletedAt: null,
        assignedToId: { not: null },
      },
      select: { id: true, senderName: true, assignedToId: true },
    });

    for (const p of near) {
      if (await this.isDuped('petition_near', p.id, p.assignedToId!)) continue;
      await this.pushService.sendToUser(p.assignedToId!, {
        title: 'Đơn thư sắp đến hạn',
        body: `Đơn của ${p.senderName} sắp đến hạn xử lý`,
        data: { type: 'petition_near_deadline', id: p.id, link: `/petitions/${p.id}` },
      });
      await this.markNotified('petition_near', p.id, p.assignedToId!);
    }
  }

  private async isDuped(resourceType: string, resourceId: string, userId: string): Promise<boolean> {
    const since = subHours(new Date(), 24);
    const existing = await this.prisma.overdueNotification.findUnique({
      where: { resourceType_resourceId_userId: { resourceType, resourceId, userId } },
    });
    return existing ? existing.notifiedAt > since : false;
  }

  private async markNotified(resourceType: string, resourceId: string, userId: string) {
    await this.prisma.overdueNotification.upsert({
      where: { resourceType_resourceId_userId: { resourceType, resourceId, userId } },
      create: { resourceType, resourceId, userId },
      update: { notifiedAt: new Date() },
    });
  }
}
