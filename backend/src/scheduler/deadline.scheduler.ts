import { readersOf } from '../authz/record-readers';
import type { RecordSubject } from '../common/utils/precise-scope';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';
import { addDays, differenceInDays, startOfDay, subHours } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { SETTINGS_KEY } from '../common/constants/settings-keys.constants';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import type { RecordKind } from '../processing-flow/gateway/record-snapshot';
import { RecordDeadlineWriter } from '../processing-flow/records/record-deadline-writer.service';

/** The switch of the new reminders (a later change); while it is on they own the records whose deadline a flow keeps. */
const REMINDERS_SWITCH = 'processing_flow_reminders';

/** Above this many ids the exclusion is done in memory instead of with `NOT IN (...)`. */
export const MAX_NOT_IN_IDS = 5000;

const TERMINAL_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.DINH_CHI,
  CaseStatus.TAM_DINH_CHI,
  CaseStatus.DA_LUU_TRU,
  CaseStatus.DA_KET_LUAN,
];
const TERMINAL_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.TAM_DINH_CHI,
  IncidentStatus.DA_GIAI_QUYET,
  IncidentStatus.DA_CHUYEN_VU_AN,
  IncidentStatus.KHONG_KHOI_TO,
  IncidentStatus.CHUYEN_XPHC,
  IncidentStatus.TDC_HET_THOI_HIEU,
  IncidentStatus.TDC_HTH_KHONG_KT,
  IncidentStatus.PHUC_HOI_NGUON_TIN,
  IncidentStatus.DA_CHUYEN_DON_VI,
  IncidentStatus.DA_NHAP_VU_KHAC,
  IncidentStatus.PHAN_LOAI_DAN_SU,
];
const TERMINAL_PETITION_STATUSES: PetitionStatus[] = [
  PetitionStatus.DA_GIAI_QUYET,
  PetitionStatus.DA_CHUYEN_VU_VIEC,
  PetitionStatus.DA_CHUYEN_VU_AN,
];

@Injectable()
export class DeadlineScheduler {
  private readonly logger = new Logger(DeadlineScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    @Optional() private readonly flags?: FeatureFlagsService,
    @Optional() private readonly deadlineWriter?: RecordDeadlineWriter,
  ) {}

  /**
   * The records this run must leave alone: those whose deadline a flow keeps, once the NEW reminders are on
   * (`processing_flow_reminders`), because they remind about the step and a second notice about the same deadline would
   * be noise. `null` (nothing excluded: the queries are exactly the old ones) while the switch is off, when no writer is
   * wired, or when either lookup fails: a duplicate reminder is better than a missed one.
   */
  private async managedExclusions(): Promise<Record<RecordKind, string[]> | null> {
    if (!this.flags || !this.deadlineWriter) return null;
    try {
      if (!(await this.flags.isEnabled(REMINDERS_SWITCH))) return null;
      const [cases, incidents, petitions] = await Promise.all([
        this.deadlineWriter.managedRecordIds('CASE'),
        this.deadlineWriter.managedRecordIds('INCIDENT'),
        this.deadlineWriter.managedRecordIds('PETITION'),
      ]);
      return { CASE: cases, INCIDENT: incidents, PETITION: petitions };
    } catch (err) {
      this.logger.error('DeadlineScheduler: failed to read the records with a managed deadline, reminding about all of them', err);
      return null;
    }
  }

  /**
   * `{ id: { notIn } }` for the ids to leave out, nothing at all when there are none OR when there are too many for one
   * query: a `NOT IN` list goes out as bind parameters, and tens of thousands of them exceed the driver's limit (the
   * query would fail and that kind's reminders would be lost). A long list is applied in memory by `survivors`.
   */
  private leaveOut(ids: string[] | undefined): { id?: { notIn: string[] } } {
    return ids && ids.length > 0 && ids.length <= MAX_NOT_IN_IDS ? { id: { notIn: ids } } : {};
  }

  /** The rows left after a long exclusion list (see `leaveOut`); a short list was already applied by the query. These queries have no `take`, so a plain filter is complete. */
  private survivors<T extends { id: string }>(rows: T[], ids: string[] | undefined): T[] {
    if (!ids || ids.length <= MAX_NOT_IN_IDS) return rows;
    const leftOut = new Set(ids);
    return rows.filter((row) => !leftOut.has(row.id));
  }

  @Cron('0 7 * * *')
  async checkDeadlines() {
    this.logger.log('DeadlineScheduler: running deadline check');
    const today = new Date();
    const managed = await this.managedExclusions();

    let thresholdSetting: { value: string } | null = null;
    try {
      thresholdSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'CANH_BAO_SAP_HAN' },
      });
    } catch (err) {
      this.logger.error('DeadlineScheduler: failed to read CANH_BAO_SAP_HAN setting, using default 7', err);
    }
    const warnDays = parseInt(thresholdSetting?.value ?? '7', 10);
    const safeWarnDays = Number.isNaN(warnDays) ? 7 : warnDays;
    const inWarnDays = addDays(today, safeWarnDays);

    await Promise.allSettled([
      this.checkCases(today, inWarnDays, managed?.CASE),
      this.checkIncidents(today, inWarnDays, managed?.INCIDENT),
      this.checkPetitions(today, inWarnDays, managed?.PETITION),
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
    subject: RecordSubject,
  ): Promise<string[]> {
    const chosen = await this.membersAndGrantees(assignedTeamId, directUserId);
    // Under permissions by team a notice names a record only to somebody who may open it.
    return readersOf(chosen, subject, { assignedTeamId, ownerId: directUserId });
  }

  private async membersAndGrantees(
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
          role: { name: { not: ROLE_NAMES.ADMIN } },
        },
        select: { id: true },
      });

      const result = new Set<string>(filtered.map((u) => u.id));
      if (directUserId) result.add(directUserId);
      return [...result];
    }

    return directUserId ? [directUserId] : [];
  }

  private async checkCases(today: Date, inWarnDays: Date, leaveOutIds?: string[]) {
    const overdue = await this.prisma.case.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { lt: today },
        status: { notIn: TERMINAL_CASE_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const c of this.survivors(overdue, leaveOutIds)) {
      const recipients = await this.getTeamRecipients(c.assignedTeamId, c.investigatorId, 'Case');
      for (const userId of recipients) {
        if (await this.isDuped('case', c.id, userId)) continue;
        await this.markNotified('case', c.id, userId);
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
      }
    }

    const near = await this.prisma.case.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_CASE_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true, deadline: true },
    });

    for (const c of this.survivors(near, leaveOutIds)) {
      const daysLeft = c.deadline ? differenceInDays(startOfDay(c.deadline), startOfDay(today)) : 0;
      const dayStr = daysLeft <= 0 ? 'hôm nay' : `còn ${daysLeft} ngày`;
      const recipients = await this.getTeamRecipients(c.assignedTeamId, c.investigatorId, 'Case');
      for (const userId of recipients) {
        if (await this.isDuped('case_near', c.id, userId)) continue;
        await this.markNotified('case_near', c.id, userId);
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'CASE_DEADLINE_NEAR',
            title: 'Vụ án sắp đến hạn',
            message: `${c.name} — ${dayStr} đến hạn giải quyết`,
            link: `/cases/${c.id}`,
            metadata: { caseId: c.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ án sắp đến hạn',
          body: `${c.name} sắp đến hạn giải quyết`,
          data: { type: 'case_near_deadline', id: c.id, link: `/cases/${c.id}`, daysLeft: String(daysLeft) },
        });
      }
    }
  }

  private async checkIncidents(today: Date, inWarnDays: Date, leaveOutIds?: string[]) {
    const overdue = await this.prisma.incident.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { lt: today },
        status: { notIn: TERMINAL_INCIDENT_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true },
    });

    for (const inc of this.survivors(overdue, leaveOutIds)) {
      const recipients = await this.getTeamRecipients(inc.assignedTeamId, inc.investigatorId, 'Incident');
      for (const userId of recipients) {
        if (await this.isDuped('incident', inc.id, userId)) continue;
        await this.markNotified('incident', inc.id, userId);
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
      }
    }

    const near = await this.prisma.incident.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_INCIDENT_STATUSES },
        deletedAt: null,
        OR: [{ investigatorId: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, name: true, investigatorId: true, assignedTeamId: true, deadline: true },
    });

    for (const inc of this.survivors(near, leaveOutIds)) {
      const daysLeft = inc.deadline ? differenceInDays(startOfDay(inc.deadline), startOfDay(today)) : 0;
      const dayStr = daysLeft <= 0 ? 'hôm nay' : `còn ${daysLeft} ngày`;
      const recipients = await this.getTeamRecipients(inc.assignedTeamId, inc.investigatorId, 'Incident');
      for (const userId of recipients) {
        if (await this.isDuped('incident_near', inc.id, userId)) continue;
        await this.markNotified('incident_near', inc.id, userId);
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'INCIDENT_DEADLINE_NEAR',
            title: 'Vụ việc sắp đến hạn',
            message: `${inc.name} — ${dayStr} đến hạn xử lý`,
            link: `/incidents/${inc.id}`,
            metadata: { incidentId: inc.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Vụ việc sắp đến hạn',
          body: `${inc.name} sắp đến hạn xử lý`,
          data: { type: 'incident_near_deadline', id: inc.id, link: `/incidents/${inc.id}`, daysLeft: String(daysLeft) },
        });
      }
    }
  }

  private async checkPetitions(today: Date, inWarnDays: Date, leaveOutIds?: string[]) {
    // Petitions: directUserId = enteredById (mirrors buildPetitionScopeFilter ownership).
    const overdue = await this.prisma.petition.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { lt: today },
        status: { notIn: TERMINAL_PETITION_STATUSES },
        deletedAt: null,
        OR: [{ enteredById: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, senderName: true, enteredById: true, assignedTeamId: true },
    });

    for (const p of this.survivors(overdue, leaveOutIds)) {
      const recipients = await this.getTeamRecipients(p.assignedTeamId, p.enteredById, 'Petition');
      for (const userId of recipients) {
        if (await this.isDuped('petition', p.id, userId)) continue;
        await this.markNotified('petition', p.id, userId);
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
      }
    }

    const near = await this.prisma.petition.findMany({
      where: {
        ...this.leaveOut(leaveOutIds),
        deadline: { gte: today, lte: inWarnDays },
        status: { notIn: TERMINAL_PETITION_STATUSES },
        deletedAt: null,
        OR: [{ enteredById: { not: null } }, { assignedTeamId: { not: null } }],
      },
      select: { id: true, senderName: true, enteredById: true, assignedTeamId: true, deadline: true },
    });

    for (const p of this.survivors(near, leaveOutIds)) {
      const daysLeft = p.deadline ? differenceInDays(startOfDay(p.deadline), startOfDay(today)) : 0;
      const dayStr = daysLeft <= 0 ? 'hôm nay' : `còn ${daysLeft} ngày`;
      const recipients = await this.getTeamRecipients(p.assignedTeamId, p.enteredById, 'Petition');
      for (const userId of recipients) {
        if (await this.isDuped('petition_near', p.id, userId)) continue;
        await this.markNotified('petition_near', p.id, userId);
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'PETITION_DEADLINE_NEAR',
            title: 'Đơn thư sắp đến hạn',
            message: `Đơn của ${p.senderName} — ${dayStr} đến hạn xử lý`,
            link: `/petitions/${p.id}`,
            metadata: { petitionId: p.id },
          },
        });
        await this.pushService.sendToUser(userId, {
          title: 'Đơn thư sắp đến hạn',
          body: `Đơn của ${p.senderName} sắp đến hạn xử lý`,
          data: { type: 'petition_near_deadline', id: p.id, link: `/petitions/${p.id}`, daysLeft: String(daysLeft) },
        });
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
