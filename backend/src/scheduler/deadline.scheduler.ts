import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';
import { addDays, subHours } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

const TERMINAL_CASE_STATUSES: CaseStatus[] = ['DINH_CHI', 'TAM_DINH_CHI', 'DA_LUU_TRU', 'DA_KET_LUAN'];
const TERMINAL_INCIDENT_STATUSES: IncidentStatus[] = [
  'TAM_DINH_CHI', 'DA_GIAI_QUYET', 'DA_CHUYEN_VU_AN', 'KHONG_KHOI_TO',
  'CHUYEN_XPHC', 'TDC_HET_THOI_HIEU', 'TDC_HTH_KHONG_KT',
  'PHUC_HOI_NGUON_TIN', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC', 'PHAN_LOAI_DAN_SU',
];
const TERMINAL_PETITION_STATUSES: PetitionStatus[] = ['DA_GIAI_QUYET', 'DA_CHUYEN_VU_VIEC', 'DA_CHUYEN_VU_AN'];

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
    const safeWarnDays = Number.isNaN(warnDays) ? 7 : warnDays;
    const inWarnDays = addDays(today, safeWarnDays);

    await Promise.allSettled([
      this.checkCases(today, inWarnDays),
      this.checkIncidents(today, inWarnDays),
      this.checkPetitions(today, inWarnDays),
    ]);

    this.logger.log('DeadlineScheduler: done');
  }

  /**
   * Returns user IDs who should receive notifications for a record.
   * Mirrors buildScopeFilter / buildPetitionScopeFilter web access logic:
   *   - directUserId: investigatorId (cases/incidents) or enteredById (petitions) — always included
   *   - Team members via UserTeam where teamId = assignedTeamId
   *   - DataAccessGrant holders (READ/WRITE, non-expired) for the team
   *   - Team-expanded users are filtered: inactive users and ADMIN role are excluded
   *   - directUserId is kept regardless of role (they are directly assigned/entered)
   */
  async getTeamRecipients(
    assignedTeamId: string | null,
    directUserId: string | null,
  ): Promise<string[]> {
    const ids = new Set<string>();

    if (directUserId) ids.add(directUserId);

    if (assignedTeamId) {
      const members = await this.prisma.userTeam.findMany({
        where: { teamId: assignedTeamId },
        select: { userId: true },
      });
      members.forEach((m) => ids.add(m.userId));

      const grants = await this.prisma.dataAccessGrant.findMany({
        where: {
          teamId: assignedTeamId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { granteeId: true },
      });
      grants.forEach((g) => ids.add(g.granteeId));
    }

    if (ids.size === 0) return [];

    const teamExpandedIds = [...ids].filter((id) => id !== directUserId);

    if (teamExpandedIds.length > 0) {
      const filtered = await this.prisma.user.findMany({
        where: {
          id: { in: teamExpandedIds },
          isActive: true,
          role: { name: { not: 'ADMIN' } },
        },
        select: { id: true },
      });

      const result = new Set<string>(filtered.map((u) => u.id));
      if (directUserId) result.add(directUserId);
      return [...result];
    }

    return directUserId ? [directUserId] : [];
  }

  private async checkCases(today: Date, inWarnDays: Date) {
    const overdue = await this.prisma.case.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_CASE_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const c of overdue) {
      const recipients = await this.getTeamRecipients(c.assignedTeamId, c.investigatorId);
      for (const userId of recipients) {
        if (await this.isDuped('case', c.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'CASE_OVERDUE',
            title: 'Vụ án quá hạn',
            message: `${c.name} đã quá hạn giải quyết`,
            link: `/cases/${c.id}`,
            metadata: { caseId: c.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ án quá hạn',
          body: `${c.name} đã quá hạn giải quyết`,
          data: { type: 'case_overdue', id: c.id, link: `/cases/${c.id}` },
        });
        await this.markNotified('case', c.id, userId);
      }
    }

    const near = await this.prisma.case.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_CASE_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const c of near) {
      const recipients = await this.getTeamRecipients(c.assignedTeamId, c.investigatorId);
      for (const userId of recipients) {
        if (await this.isDuped('case_near', c.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'CASE_DEADLINE_NEAR',
            title: 'Vụ án sắp đến hạn',
            message: `${c.name} sắp đến hạn giải quyết`,
            link: `/cases/${c.id}`,
            metadata: { caseId: c.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ án sắp đến hạn',
          body: `${c.name} sắp đến hạn giải quyết`,
          data: { type: 'case_near_deadline', id: c.id, link: `/cases/${c.id}` },
        });
        await this.markNotified('case_near', c.id, userId);
      }
    }
  }

  private async checkIncidents(today: Date, inWarnDays: Date) {
    const overdue = await this.prisma.incident.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_INCIDENT_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const inc of overdue) {
      const recipients = await this.getTeamRecipients(inc.assignedTeamId, inc.investigatorId);
      for (const userId of recipients) {
        if (await this.isDuped('incident', inc.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'INCIDENT_OVERDUE',
            title: 'Vụ việc quá hạn',
            message: `${inc.name} đã quá hạn xử lý`,
            link: `/incidents/${inc.id}`,
            metadata: { incidentId: inc.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ việc quá hạn',
          body: `${inc.name} đã quá hạn xử lý`,
          data: { type: 'incident_overdue', id: inc.id, link: `/incidents/${inc.id}` },
        });
        await this.markNotified('incident', inc.id, userId);
      }
    }

    const near = await this.prisma.incident.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_INCIDENT_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const inc of near) {
      const recipients = await this.getTeamRecipients(inc.assignedTeamId, inc.investigatorId);
      for (const userId of recipients) {
        if (await this.isDuped('incident_near', inc.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'INCIDENT_DEADLINE_NEAR',
            title: 'Vụ việc sắp đến hạn',
            message: `${inc.name} sắp đến hạn xử lý`,
            link: `/incidents/${inc.id}`,
            metadata: { incidentId: inc.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ việc sắp đến hạn',
          body: `${inc.name} sắp đến hạn xử lý`,
          data: { type: 'incident_near_deadline', id: inc.id, link: `/incidents/${inc.id}` },
        });
        await this.markNotified('incident_near', inc.id, userId);
      }
    }
  }

  private async checkPetitions(today: Date, inWarnDays: Date) {
    // Petitions: directUserId = enteredById (mirrors buildPetitionScopeFilter ownership).
    const overdue = await this.prisma.petition.findMany({
      where: {
        deadline: { lt: today },
        status: { notIn: TERMINAL_PETITION_STATUSES },
        deletedAt: null,
        OR: [{ enteredById: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, senderName: true, enteredById: true, assignedTeamId: true },
    });

    for (const p of overdue) {
      const recipients = await this.getTeamRecipients(p.assignedTeamId, p.enteredById);
      for (const userId of recipients) {
        if (await this.isDuped('petition', p.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'PETITION_OVERDUE',
            title: 'Đơn thư quá hạn',
            message: `Đơn của ${p.senderName} đã quá hạn xử lý`,
            link: `/petitions/${p.id}`,
            metadata: { petitionId: p.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Đơn thư quá hạn',
          body: `Đơn của ${p.senderName} đã quá hạn xử lý`,
          data: { type: 'petition_overdue', id: p.id, link: `/petitions/${p.id}` },
        });
        await this.markNotified('petition', p.id, userId);
      }
    }

    const near = await this.prisma.petition.findMany({
      where: {
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_PETITION_STATUSES },
        deletedAt: null,
        OR: [{ enteredById: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, senderName: true, enteredById: true, assignedTeamId: true },
    });

    for (const p of near) {
      const recipients = await this.getTeamRecipients(p.assignedTeamId, p.enteredById);
      for (const userId of recipients) {
        if (await this.isDuped('petition_near', p.id, userId)) continue;
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'PETITION_DEADLINE_NEAR',
            title: 'Đơn thư sắp đến hạn',
            message: `Đơn của ${p.senderName} sắp đến hạn xử lý`,
            link: `/petitions/${p.id}`,
            metadata: { petitionId: p.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Đơn thư sắp đến hạn',
          body: `Đơn của ${p.senderName} sắp đến hạn xử lý`,
          data: { type: 'petition_near_deadline', id: p.id, link: `/petitions/${p.id}` },
        });
        await this.markNotified('petition_near', p.id, userId);
      }
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
