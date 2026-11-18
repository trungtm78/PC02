import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, type Prisma, type WardReminderKind } from '@prisma/client';
import { enforcement, userHoldingPermission } from '../authz/enforcement';
import { readersOf } from '../authz/record-readers';
import { recordInActionScope } from '../common/utils/scope-filter.util';
import { NotificationSseService } from '../notifications/notification-sse.service';
import { PrismaService } from '../prisma/prisma.service';
import { alertOf, ALERT_YELLOW_DAYS, type AlertLevel } from './ward-alerts';
import { reachOf, wardReadable } from './ward-locks';
import { decisionInForce, vnDay } from './ward-review.rules';

/**
 * Notices of ward assignment requests on the web bell (plan A12, A13, C8, R8; no push: the mobile app has no screen
 * for these requests yet).
 *
 *   a new submission         → the reviewers: people holding `review:WardAssignment` whose review reach covers it,
 *                              never a member of the request's own ward unit (they may not decide it);
 *   a re-submission          → the reviewer who returned the previous round;
 *   returned / approved      → the people of the ward unit and the person who entered the request;
 *   the deadline YELLOW, RED → the PC02 follow-up officer and the person who entered it, once per level and deadline;
 *   OVERDUE                  → the same people, once per day; nothing once the request is completed.
 *
 * Everybody told is somebody who may open the request (`readersOf`). The mark "told" (`ward_assignment_reminders`,
 * unique key) and the notices are written in ONE transaction: a second call adds nothing, a crash before the commit
 * leaves neither, so the next run tells them. Not the 24-hour window of the old deadline scheduler.
 */

export type WardNoticeEvent =
  /** "Trình" / "Trình lại": which of the two is read from the round (a round after a return is a re-submission). */
  | { kind: 'SUBMITTED'; assignmentId: string; roundId: string }
  /** PC02's decision on a round ("Trả về" / "Duyệt"). */
  | { kind: 'RETURNED' | 'APPROVED'; assignmentId: string; decisionId: string };

type Tx = Prisma.TransactionClient;

const NOTICE_TYPE: Record<WardReminderKind, NotificationType> = {
  SUBMITTED: NotificationType.WARD_ASSIGNMENT_SUBMITTED,
  RESUBMITTED: NotificationType.WARD_ASSIGNMENT_RESUBMITTED,
  RETURNED: NotificationType.WARD_ASSIGNMENT_RETURNED,
  APPROVED: NotificationType.WARD_ASSIGNMENT_APPROVED,
  DUE_YELLOW: NotificationType.WARD_ASSIGNMENT_DEADLINE_NEAR,
  DUE_RED: NotificationType.WARD_ASSIGNMENT_DEADLINE_NEAR,
  OVERDUE: NotificationType.WARD_ASSIGNMENT_OVERDUE,
};

const NOTHING_TO_RING = () => undefined;
const DAY_MS = 86_400_000;
const isoDay = (day: Date) => day.toISOString().slice(0, 10);
const dmy = (day: Date) => `${isoDay(day).slice(8, 10)}/${isoDay(day).slice(5, 7)}/${isoDay(day).slice(0, 4)}`;

interface RequestRow {
  id: string;
  code: string | null;
  summary: string;
  assignedTeamId: string;
  enteredById: string;
}

export interface DeadlineRunResult {
  told: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class WardNotifier {
  private readonly logger = new Logger(WardNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly sse?: NotificationSseService,
  ) {}

  /**
   * Called by the commands INSIDE their transaction, after the state change: the notices of the event are written
   * with it (rolled back with it). Returns what rings the bells: call it AFTER the commit.
   *
   *   let ring = () => {};
   *   const row = await this.prisma.$transaction(async (tx) => { ...; ring = await this.notifier.recordEvent(tx, event); return row; });
   *   ring();
   */
  async recordEvent(tx: Tx, event: WardNoticeEvent): Promise<() => void> {
    const row = await tx.wardAssignment.findUnique({ where: { id: event.assignmentId }, select: { id: true, code: true, summary: true, assignedTeamId: true, enteredById: true } });
    if (!row) return NOTHING_TO_RING;
    if (event.kind === 'SUBMITTED') {
      const round = await tx.wardAssignmentRound.findUnique({ where: { id: event.roundId }, select: { id: true, sequence: true, submissionNo: true, priorStatus: true, assignmentId: true } });
      if (!round || round.assignmentId !== row.id) return NOTHING_TO_RING;
      if (round.priorStatus === 'RETURNED') {
        const returner = await this.returnerBefore(tx, row.id, round.sequence);
        return this.tell(tx, row, 'RESUBMITTED', `RESUBMITTED:${round.id}`, this.readers(returner ? [returner] : [], row), {
          title: 'Hồ sơ phân công được trình lại',
          message: `${this.label(row)} đã được đơn vị trình lại (lần ${round.submissionNo}).`,
        });
      }
      return this.tell(tx, row, 'SUBMITTED', `SUBMITTED:${round.id}`, await this.reviewersOf(tx, row), {
        title: 'Hồ sơ phân công mới chờ duyệt',
        message: `${this.label(row)} vừa được trình, chờ PC02 thẩm định.`,
      });
    }
    const decision = await tx.wardAssignmentDecision.findUnique({ where: { id: event.decisionId }, select: { id: true, kind: true, round: { select: { assignmentId: true } } } });
    if (!decision || decision.round.assignmentId !== row.id) return NOTHING_TO_RING;
    const kind: WardReminderKind = event.kind === 'RETURNED' ? 'RETURNED' : 'APPROVED';
    return this.tell(tx, row, kind, `${kind}:${decision.id}`, await this.unitPeopleOf(tx, row), {
      title: kind === 'RETURNED' ? 'Hồ sơ phân công bị trả về' : 'Hồ sơ phân công đã được duyệt',
      message: kind === 'RETURNED' ? `${this.label(row)} bị PC02 trả về: xem lý do và yêu cầu bổ sung.` : `${this.label(row)} đã được PC02 duyệt và phân công Điều tra viên.`,
    });
  }

  /**
   * The 07:00 run: every approved, open request whose deadline is within the yellow band or past. Each request in its
   * own transaction, re-read there under a share lock (a completion, an extension or a cancelled approval made
   * meanwhile is seen, or waits for this): nothing is said that is no longer true. One request failing does not stop
   * the others.
   */
  async remindDeadlines(now: Date = new Date()): Promise<DeadlineRunResult> {
    const today = vnDay(now);
    const horizon = new Date(today.getTime() + ALERT_YELLOW_DAYS * DAY_MS);
    const due = await this.prisma.wardAssignment.findMany({
      where: { status: 'APPROVED', completedOn: null, archivedAt: null, resultDueOn: { not: null, lte: horizon } },
      select: { id: true },
      orderBy: { resultDueOn: 'asc' },
    });
    const result: DeadlineRunResult = { told: 0, skipped: 0, failed: 0 };
    for (const { id } of due) {
      try {
        let ring: () => void = NOTHING_TO_RING;
        const told = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "ward_assignments" WHERE id = ${id} FOR SHARE`;
          const row = await tx.wardAssignment.findUnique({
            where: { id },
            select: { id: true, code: true, summary: true, assignedTeamId: true, enteredById: true, status: true, completedOn: true, resultDueOn: true, archivedAt: true, followUpUserId: true },
          });
          if (!row || row.archivedAt || !row.resultDueOn) return false;
          const level = alertOf(row, today).level;
          const kind = deadlineKind(level);
          if (!kind) return false;
          const approval = await this.approvalInForce(tx, row.id);
          if (!approval) return false;
          const generation = `${approval}:${isoDay(row.resultDueOn)}`;
          const key = `${kind}:${row.id}:${generation}${kind === 'OVERDUE' ? `:${isoDay(today)}` : ''}`;
          const people = [row.followUpUserId, row.enteredById].filter((v): v is string => !!v);
          const daysLeft = Math.round((row.resultDueOn.getTime() - today.getTime()) / DAY_MS);
          ring = await this.tell(
            tx,
            row,
            kind,
            key,
            this.readers([...new Set(people)], row),
            kind === 'OVERDUE'
              ? { title: 'Hồ sơ phân công quá hạn báo kết quả', message: `${this.label(row)} quá hạn báo kết quả ${-daysLeft} ngày (hạn ${dmy(row.resultDueOn)}).` }
              : { title: 'Hồ sơ phân công sắp đến hạn báo kết quả', message: `${this.label(row)} còn ${daysLeft} ngày đến hạn báo kết quả (${dmy(row.resultDueOn)}).` },
            { dueOn: row.resultDueOn, day: kind === 'OVERDUE' ? today : null },
          );
          return ring !== NOTHING_TO_RING;
        });
        ring();
        if (told) result.told += 1;
        else result.skipped += 1;
      } catch (error) {
        result.failed += 1;
        this.logger.error(`Ward deadline reminder of ${id} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return result;
  }

  /**
   * The mark and the notices, in the caller's transaction. Nobody to tell: no mark either (a person who gains the
   * right to read the request before the next run is then told). A mark already there: nothing.
   */
  private async tell(
    tx: Tx,
    row: RequestRow,
    kind: WardReminderKind,
    dedupeKey: string,
    recipients: string[],
    text: { title: string; message: string },
    dates: { dueOn?: Date | null; day?: Date | null } = {},
  ): Promise<() => void> {
    const type = NOTICE_TYPE[kind];
    const off = await tx.notificationPreference.findMany({ where: { userId: { in: recipients }, eventType: type, inApp: false }, select: { userId: true } });
    const people = recipients.filter((userId) => !off.some((p) => p.userId === userId));
    if (people.length === 0) return NOTHING_TO_RING;
    const marked = await tx.wardAssignmentReminder.createMany({
      data: [{ dedupeKey, assignmentId: row.id, kind, dueOn: dates.dueOn ?? null, day: dates.day ?? null, recipientCount: people.length }],
      skipDuplicates: true,
    });
    if (marked.count === 0) return NOTHING_TO_RING;
    await tx.notification.createMany({
      data: people.map((userId) => ({
        userId,
        type,
        title: text.title,
        message: text.message,
        link: `/ho-so-phan-cong/${row.id}`,
        metadata: { wardAssignmentId: row.id, code: row.code, reminderKind: kind } as Prisma.InputJsonValue,
        // Web bell only (R8): no push to an app that cannot open the request.
        pushNextRetryAt: null,
        pushMaxRetries: 0,
      })),
    });
    return () => {
      for (const userId of people) this.sse?.notifyUser(userId);
    };
  }

  private label(row: { code: string | null; summary: string }): string {
    const summary = row.summary.length > 80 ? `${row.summary.slice(0, 79)}…` : row.summary;
    return `Hồ sơ ${row.code ?? ''} "${summary}"`.replace('  ', ' ');
  }

  /**
   * Of these people, who may READ the request now, by the module's own read rule: the shared desk at PC02 is told
   * nothing about a request once it was submitted (the bell would show its code and summary to whoever sits there).
   */
  private readers(people: readonly string[], row: Pick<RequestRow, 'assignedTeamId' | 'enteredById' | 'code'>): string[] {
    const current = enforcement();
    return readersOf(people, 'WardAssignment', reachOf(row)).filter((userId) => {
      try {
        return wardReadable(row, current ? current.scopeOf(userId) : undefined);
      } catch {
        return false;
      }
    });
  }

  /** Active people holding `review:WardAssignment` whose review reach covers the request, not of its own unit. */
  private async reviewersOf(tx: Tx, row: RequestRow): Promise<string[]> {
    const holders = await tx.user.findMany({
      where: { AND: [{ isActive: true }, userHoldingPermission('review', 'WardAssignment'), { userTeams: { none: { teamId: row.assignedTeamId } } }] },
      select: { id: true },
    });
    const reach = reachOf(row);
    const current = enforcement();
    return this.readers(
      holders.map((h) => h.id),
      row,
    ).filter((userId) => {
      try {
        return !!current && recordInActionScope(reach, current.scopeOf(userId), 'WardAssignment', 'review');
      } catch {
        return false;
      }
    });
  }

  /** The active members of the ward unit and the person who entered the request, who may read it. */
  private async unitPeopleOf(tx: Tx, row: RequestRow): Promise<string[]> {
    const members = await tx.userTeam.findMany({ where: { teamId: row.assignedTeamId, user: { isActive: true } }, select: { userId: true } });
    const entered = await tx.user.findFirst({ where: { id: row.enteredById, isActive: true }, select: { id: true } });
    const people = [...new Set([...members.map((m) => m.userId), ...(entered ? [entered.id] : [])])];
    return this.readers(people, row);
  }

  /** Who returned the round before this one (its decision in force, a return), if anybody. */
  private async returnerBefore(tx: Tx, assignmentId: string, sequence: number): Promise<string | null> {
    const previous = await tx.wardAssignmentRound.findFirst({
      where: { assignmentId, sequence: { lt: sequence }, status: 'DECIDED' },
      orderBy: { sequence: 'desc' },
      select: { decisions: { select: { id: true, kind: true, decidedAt: true, revokedAt: true, decidedById: true } } },
    });
    const inForce = previous ? decisionInForce(previous.decisions) : null;
    if (inForce?.kind !== 'RETURN') return null;
    const person = await tx.user.findFirst({ where: { id: inForce.decidedById, isActive: true }, select: { id: true } });
    return person?.id ?? null;
  }

  /** The approval in force of the request (the latest decided round's decision in force, an approval). */
  private async approvalInForce(tx: Tx, assignmentId: string): Promise<string | null> {
    const round = await tx.wardAssignmentRound.findFirst({
      where: { assignmentId, status: 'DECIDED' },
      orderBy: { sequence: 'desc' },
      select: { decisions: { select: { id: true, kind: true, decidedAt: true, revokedAt: true } } },
    });
    const inForce = round ? decisionInForce(round.decisions) : null;
    return inForce?.kind === 'APPROVE' ? inForce.id : null;
  }
}

function deadlineKind(level: AlertLevel): WardReminderKind | null {
  return level === 'YELLOW' ? 'DUE_YELLOW' : level === 'RED' ? 'DUE_RED' : level === 'OVERDUE' ? 'OVERDUE' : null;
}

/**
 * Removes the rows of lane D of one request (match conclusions, reminder marks): for "delete with its data", in the
 * same transaction, before the request itself. Answers how many rows each table lost (for the confirmation screen).
 */
export async function deleteWardAlertRows(tx: Tx, assignmentId: string): Promise<{ conclusions: number; reminders: number }> {
  // Its own conclusions, and those of other requests about it.
  const conclusions = await tx.wardSubjectMatchConclusion.deleteMany({ where: { OR: [{ assignmentId }, { otherSource: 'WARD_ASSIGNMENT', otherRecordId: assignmentId }] } });
  const reminders = await tx.wardAssignmentReminder.deleteMany({ where: { assignmentId } });
  return { conclusions: conclusions.count, reminders: reminders.count };
}
