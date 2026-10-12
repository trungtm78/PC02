import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generatePeriods } from '../engine/period';
import type { ScheduleRule } from '../engine/period';
import { ReportConfigError } from './report-config.service';
import type { UpdateReportConfigDto } from './dto/update-report-config.dto';

export interface UpdateReportConfigResult {
  configVersion: number;
  /** What actually changed, so the screen can say so. */
  changed: Array<'info' | 'schedule' | 'roles' | 'targets'>;
}

type Schedule = NonNullable<UpdateReportConfigDto['schedule']>;

function toScheduleRule(s: Schedule): ScheduleRule {
  return {
    periodType: s.periodType,
    periodStartDay: s.periodStartDay,
    due: s.dueRule as ScheduleRule['due'],
    open: s.openRule as ScheduleRule['open'],
    shiftNonWorking: s.shiftNonWorking,
    oneTimeDate: s.oneTimeDate,
  };
}

/** Stable text of a JSON value, so two rules that say the same thing compare equal whatever order their keys came in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined && o[k] !== null)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

const active = (now: Date) => ({
  validFrom: { lte: now },
  OR: [{ validTo: null }, { validTo: { gt: now } }],
});

/**
 * "Sửa cấu hình" of an existing report (design standard: created ⇒ editable).
 *
 * D09 again: changes apply FROM THE NEXT PERIOD. A period already generated keeps the schedule, the teams and the
 * editors it was generated with (its assignments are its own rows; changing who types in an open period is the
 * mid-period action on the period screen, with its reason and audit). Managers and viewers are different: they are
 * checked live, so a change to them takes effect at once.
 *
 * Nothing is deleted: a role, a target or an editor that leaves gets an end date (`validTo`), so history says who
 * was responsible when.
 */
@Injectable()
export class ReportConfigUpdateService {
  constructor(private readonly prisma: PrismaService) {}

  async updateConfig(
    reportId: string,
    input: UpdateReportConfigDto,
  ): Promise<UpdateReportConfigResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
      const report = await tx.dynReport.findUnique({ where: { id: reportId } });
      if (!report) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
      if (report.status === 'ARCHIVED') {
        throw new ReportConfigError('Báo cáo đã lưu trữ — hãy khôi phục trước khi sửa cấu hình.', 'INVALID_STATE');
      }
      if (report.configVersion !== input.expectedConfigVersion) {
        throw new ReportConfigError(
          'Cấu hình báo cáo vừa được người khác thay đổi. Hãy tải lại trang rồi sửa tiếp.',
          'REVISION_CONFLICT',
        );
      }

      const now = new Date();
      const changed: UpdateReportConfigResult['changed'] = [];

      if ((input.name !== undefined && input.name !== report.name) || (input.description !== undefined && (input.description || null) !== report.description)) {
        await tx.dynReport.update({
          where: { id: reportId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description || null } : {}),
          },
        });
        changed.push('info');
      }

      if (input.schedule && (await this.applySchedule(tx, reportId, input.schedule, now))) changed.push('schedule');
      if (input.roles && (await this.applyRoles(tx, reportId, input.roles, now))) changed.push('roles');
      if (input.targets && (await this.applyTargets(tx, reportId, input.targets, now))) changed.push('targets');

      let configVersion = report.configVersion;
      if (changed.length > 0) {
        const bumped = await tx.dynReport.update({
          where: { id: reportId },
          data: { configVersion: { increment: 1 } },
        });
        configVersion = bumped.configVersion;
      }
      return { configVersion, changed };
    });
  }

  /** A new schedule row from now on; the old one is closed. The cursor carries over so periods already made are not made again. */
  private async applySchedule(
    tx: Prisma.TransactionClient,
    reportId: string,
    next: Schedule,
    now: Date,
  ): Promise<boolean> {
    if (next.periodType === 'ONE_TIME' && !next.oneTimeDate) {
      throw new ReportConfigError('Loại kỳ "Một lần" phải chọn ngày của kỳ.', 'TEMPLATE_INVALID');
    }
    try {
      generatePeriods(toScheduleRule(next), now, 1);
    } catch (err) {
      throw new ReportConfigError(
        `Không tính được lịch: ${err instanceof Error ? err.message : String(err)}`,
        'TEMPLATE_INVALID',
      );
    }
    const current = await tx.dynReportSchedule.findFirst({
      where: { reportId, supersededAt: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    const same =
      current &&
      current.periodType === next.periodType &&
      (current.periodStartDay ?? null) === (next.periodStartDay ?? null) &&
      canonical(current.dueRule) === canonical(next.dueRule) &&
      canonical(current.openRule) === canonical(next.openRule) &&
      current.shiftNonWorking === (next.shiftNonWorking ?? false) &&
      (current.oneTimeDate ?? null) === (next.oneTimeDate ?? null) &&
      current.timezone === (next.timezone ?? current.timezone);
    if (same) return false;

    if (current) {
      await tx.dynReportSchedule.update({ where: { id: current.id }, data: { supersededAt: now } });
    }

    // The cursor says where the next period starts. Under the same calendar it is still right. Under a new one
    // (another period type, another start day) the period that CONTAINS the old cursor may begin earlier than it and
    // overlap what was already generated, so the cursor moves to the first new-calendar period that starts after the
    // last period that exists. The days in between, if any, belong to no period: a gap is better than two obligations
    // for the same days.
    const geometryChanged =
      !!current &&
      (current.periodType !== next.periodType ||
        (current.periodStartDay ?? 1) !== (next.periodStartDay ?? 1) ||
        (current.oneTimeDate ?? null) !== (next.oneTimeDate ?? null));
    let cursor = current?.lastGeneratedThrough ?? null;
    // A one-time schedule is done once its cursor is set, so a NEW one-time schedule starts without a cursor and makes
    // its period; an unchanged one keeps the cursor it has (its period was made, or deliberately deleted).
    if (next.periodType === 'ONE_TIME' && geometryChanged) {
      cursor = null;
    } else if (geometryChanged) {
      const last = await tx.dynReportPeriod.aggregate({ where: { reportId }, _max: { endDate: true } });
      if (last._max.endDate) {
        const dayAfter = new Date(last._max.endDate.getTime() + 86_400_000);
        cursor = this.firstPeriodStartingOnOrAfter(next, dayAfter);
      }
    }
    await tx.dynReportSchedule.create({
      data: {
        reportId,
        periodType: next.periodType,
        periodStartDay: next.periodStartDay,
        dueRule: next.dueRule as Prisma.InputJsonValue,
        openRule: next.openRule as Prisma.InputJsonValue,
        shiftNonWorking: next.shiftNonWorking ?? false,
        oneTimeDate: next.oneTimeDate,
        timezone: next.timezone ?? current?.timezone ?? 'Asia/Ho_Chi_Minh',
        effectiveFrom: now,
        lastGeneratedThrough: cursor,
      },
    });
    return true;
  }

  /** The start of the first period, in the new calendar, that begins on or after `day` (the calendar may put a boundary mid-way). */
  private firstPeriodStartingOnOrAfter(next: Schedule, day: Date): Date {
    const [period] = generatePeriods(toScheduleRule(next), day, 1);
    const start = new Date(`${period.periodStart}T00:00:00Z`);
    if (start >= day) return day;
    return new Date(new Date(`${period.periodEnd}T00:00:00Z`).getTime() + 86_400_000);
  }

  private async assertUsersExist(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await tx.user.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw new ReportConfigError('Có tài khoản không tồn tại trong danh sách.', 'TEMPLATE_INVALID');
    }
  }

  private async applyRoles(
    tx: Prisma.TransactionClient,
    reportId: string,
    next: NonNullable<UpdateReportConfigDto['roles']>,
    now: Date,
  ): Promise<boolean> {
    if (!next.some((r) => r.role === 'MANAGER')) {
      throw new ReportConfigError('Phải có ít nhất một quản lý.', 'TEMPLATE_INVALID');
    }
    await this.assertUsersExist(tx, next.map((r) => r.userId));
    const keyOf = (r: { userId: string; role: string; teamScopeId?: string | null }) =>
      `${r.userId}|${r.role}|${r.teamScopeId ?? ''}`;
    const wanted = new Map(next.map((r) => [keyOf(r), r]));
    const current = await tx.dynReportRole.findMany({ where: { reportId, ...active(now) } });
    const have = new Set(current.map(keyOf));

    let changed = false;
    for (const row of current) {
      if (!wanted.has(keyOf(row))) {
        await tx.dynReportRole.update({ where: { id: row.id }, data: { validTo: now } });
        changed = true;
      }
    }
    for (const [key, r] of wanted) {
      if (have.has(key)) continue;
      await tx.dynReportRole.create({
        data: { reportId, userId: r.userId, role: r.role, teamScopeId: r.teamScopeId, validFrom: now },
      });
      changed = true;
    }
    return changed;
  }

  private async applyTargets(
    tx: Prisma.TransactionClient,
    reportId: string,
    next: NonNullable<UpdateReportConfigDto['targets']>,
    now: Date,
  ): Promise<boolean> {
    if (next.length === 0) {
      throw new ReportConfigError('Phải có ít nhất một tổ phải nộp.', 'TEMPLATE_INVALID');
    }
    if (next.some((t) => t.editorUserIds.length === 0)) {
      throw new ReportConfigError('Mỗi tổ phải có ít nhất một người nhập.', 'TEMPLATE_INVALID');
    }
    const teamIds = next.map((t) => t.teamId);
    if (new Set(teamIds).size !== teamIds.length) {
      throw new ReportConfigError('Một tổ không được xuất hiện hai lần.', 'TEMPLATE_INVALID');
    }
    const teams = await tx.team.count({ where: { id: { in: teamIds } } });
    if (teams !== teamIds.length) {
      throw new ReportConfigError('Có tổ không tồn tại trong danh sách.', 'TEMPLATE_INVALID');
    }
    await this.assertUsersExist(tx, next.flatMap((t) => t.editorUserIds));

    const current = await tx.dynReportTarget.findMany({
      where: { reportId, ...active(now) },
      include: { editors: { where: active(now) } },
    });
    const byTeam = new Map(current.map((t) => [t.teamId, t]));
    const wanted = new Map(next.map((t) => [t.teamId, t]));

    let changed = false;
    // Teams that leave: the target and everyone typing for it get an end date.
    for (const target of current) {
      if (wanted.has(target.teamId)) continue;
      await tx.dynReportTarget.update({ where: { id: target.id }, data: { validTo: now } });
      await tx.dynReportTargetEditor.updateMany({
        where: { targetId: target.id, ...active(now) },
        data: { validTo: now },
      });
      changed = true;
    }
    for (const [teamId, t] of wanted) {
      const existing = byTeam.get(teamId);
      if (!existing) {
        const created = await tx.dynReportTarget.create({ data: { reportId, teamId, validFrom: now } });
        await tx.dynReportTargetEditor.createMany({
          data: [...new Set(t.editorUserIds)].map((userId) => ({ targetId: created.id, userId, validFrom: now })),
        });
        changed = true;
        continue;
      }
      const wantedEditors = new Set(t.editorUserIds);
      const haveEditors = new Set(existing.editors.map((e) => e.userId));
      for (const e of existing.editors) {
        if (!wantedEditors.has(e.userId)) {
          await tx.dynReportTargetEditor.update({ where: { id: e.id }, data: { validTo: now } });
          changed = true;
        }
      }
      for (const userId of wantedEditors) {
        if (haveEditors.has(userId)) continue;
        await tx.dynReportTargetEditor.create({ data: { targetId: existing.id, userId, validFrom: now } });
        changed = true;
      }
    }
    return changed;
  }
}
