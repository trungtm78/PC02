import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, Prisma } from '@prisma/client';
import { userHoldingPermission } from '../../authz/enforcement';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { NotificationEventService, type InAppNotice } from '../../notifications/notification-event.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { bandAt } from '../engine/bands';
import { civilDayOf } from '../engine/civil-day';
import type { Band } from '../engine/types';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { COUNTED_STEP_STATUSES, effectiveDue } from '../records/record-alert';
import { clockRuns } from '../tracking/processing-tracking.service';

/** The switch of these reminders, read at run time by every tick, every claim and the nudge (C16). */
export const REMINDERS_SWITCH = 'processing_flow_reminders';
/** A nudge acts on the flow of a record: it also needs the switch of the records. */
const RECORDS_SWITCH = 'processing_flow_records';
const LOCK_KEY = 'processing-flow-reminders';

export const REMINDER_KIND = { BAND: 'BAND', ESCALATE_PARENT: 'ESCALATE_PARENT', ESCALATE_LEADERSHIP: 'ESCALATE_LEADERSHIP', NUDGE: 'NUDGE' } as const;
export type ReminderKind = (typeof REMINDER_KIND)[keyof typeof REMINDER_KIND];
export const REMINDER_OUTCOME = { SENT: 'SENT', SUPPRESSED: 'SUPPRESSED', STALE: 'STALE', NOT_READABLE: 'NOT_READABLE', RECIPIENT_GONE: 'RECIPIENT_GONE' } as const;
export type ReminderOutcome = (typeof REMINDER_OUTCOME)[keyof typeof REMINDER_OUTCOME];
/** The action a nudge leaves in the history of its step (`ProcStepChange`). */
export const STEP_NUDGED = 'STEP_NUDGED';

/** The tab of the web form that shows the steps of a record: where every reminder leads. */
export const STEP_TAB = 'phan-cong-xu-ly';
export function stepLink(kind: RecordKind, recordId: string): string {
  if (kind === 'PETITION') return `/petitions/${recordId}?tab=${STEP_TAB}`;
  if (kind === 'INCIDENT') return `/incidents/${recordId}?tab=${STEP_TAB}`;
  return `/cases/${recordId}/edit?tab=${STEP_TAB}`;
}

const BATCH = 200;
const FIRST_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
export const MAX_REMINDER_ATTEMPTS = 8;
const MAX_ERROR_LENGTH = 500;
export const MAX_NUDGE_MESSAGE = 500;
/** The outer transaction only holds the advisory lock of a tick; the work runs in transactions of its own. */
const TICK_TIMEOUT_MS = 14 * 60 * 1000;

const STEP_SELECT = {
  id: true,
  recordFlowId: true,
  recordKind: true,
  recordId: true,
  stepKey: true,
  status: true,
  deadlineRevision: true,
  regulatoryDueAt: true,
  internalDueAt: true,
  redFrom: true,
  yellowFrom: true,
  greenFrom: true,
  step: { select: { name: true, escalateAfterDays: true, escalateLeadershipAfterDays: true } },
  parties: { select: { role: true, teamId: true, assigneeUserId: true, team: { select: { status: true, parentId: true } } } },
} satisfies Prisma.ProcRecordStepSelect;
type StepRow = Prisma.ProcRecordStepGetPayload<{ select: typeof STEP_SELECT }>;

interface Wanted {
  recipientId: string;
  kind: ReminderKind;
  dedupeKey: string;
}

interface ReminderPayload {
  stepName: string;
  recordCode: string | null;
  dueAt: string | null;
  /** Civil days (Vietnam) from the day the reminder was decided to the due day: 0 on it, negative after it. */
  remainingDays: number | null;
  message?: string;
  byUserId?: string;
}

export interface TickResult {
  /** `false`: the switch is off, or another runner holds the tick. Nothing was read or written. */
  ran: boolean;
  planned: number;
  delivered: DeliverResult;
}

export interface DeliverResult {
  sent: number;
  /** Finished without a notice: the person switched it off, may no longer read the record, or the reminder is stale. */
  dropped: number;
  retried: number;
  dead: number;
}

const NOTHING_DELIVERED: DeliverResult = { sent: 0, dropped: 0, retried: 0, dead: 0 };

/**
 * Reminders about the steps of a record, behind the switch `processing_flow_reminders`.
 *
 * WHAT IS REMINDED. A step being worked (OPEN or REPORTED) of a record whose clock runs, in its CURRENT band (GREEN,
 * YELLOW, RED, OVERDUE). Only the current band: a step first seen RED gets the red reminder and never the yellow and
 * green ones it passed. A band is reminded once; OVERDUE once every civil day (Vietnam). A new deadline
 * (`deadlineRevision` goes up with every change, so A -> B -> A too) is reminded again.
 *
 * WHO. For the MAIN and CHECK parties of the step: the person named, otherwise the active heads of the (active) unit.
 * INFORM parties are told once per band, never daily. Escalation, when the configured step says after how many civil
 * days overdue (`escalateAfterDays`, `escalateLeadershipAfterDays`; not set = no escalation): once the heads of the
 * PARENT unit of the main unit, and once the people who hold `approve:ProcessingStep`. Every recipient must be an active
 * person who may OPEN the record (`RecordGateway.canRead`, the rule of the route that shows the flow of a record: the
 * record's own policy, or a step being worked that names their unit); the answer is asked again when delivering.
 *
 * HOW (C12). One row of `proc_reminders` per reminder and recipient is BOTH the mark "decided" (a unique key: step +
 * deadline revision + band or level + recipient, + the civil day for the daily one) and the work "deliver it". The rows
 * of a step are written in one transaction, so the mark and the work cannot exist apart. A worker then delivers each
 * row through the notification path (`NotificationEventService.deliverInApp`: bell + push queue) and marks it DONE in
 * the SAME transaction as the notification row: a process that dies anywhere leaves either both or neither, so nothing
 * is lost and nothing is sent twice.
 *
 * SWITCH OFF: the tick reads nothing and writes nothing, rows already written wait, and the legacy deadline reminder
 * speaks for every record again (`DeadlineScheduler.managedExclusions` reads the same switch at run time).
 */
@Injectable()
export class ProcessingReminderService {
  private readonly logger = new Logger(ProcessingReminderService.name);
  /**
   * Narrows the service to these records. For the specs only: they share one database, and a tick there must not write
   * reminders for (or deliver) the rows of another suite. `null` in production: everything.
   */
  onlyRecordIds: string[] | null = null;
  /** The same for people: on a shared database "everybody who holds a permission" includes the people of other suites. */
  onlyUserIds: string[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly gateway: RecordGateway,
    private readonly notifications: NotificationEventService,
  ) {}

  @Cron('*/15 * * * *', { name: LOCK_KEY })
  async run(): Promise<void> {
    try {
      await this.tick(new Date());
    } catch (error) {
      this.logger.warn(`The reminder tick failed: ${String(error)}`);
    }
  }

  /** One tick at `now`: decide the reminders that are due, then deliver what waits. One runner at a time. */
  async tick(now: Date): Promise<TickResult> {
    if (!(await this.flags.isEnabled(REMINDERS_SWITCH))) return { ran: false, planned: 0, delivered: { ...NOTHING_DELIVERED } };
    const planned = await this.prisma.$transaction(
      async (lock) => {
        const [row] = await lock.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${LOCK_KEY})) AS locked`;
        if (!row?.locked) return null;
        return this.plan(now);
      },
      { timeout: TICK_TIMEOUT_MS, maxWait: 10_000 },
    );
    if (planned === null) return { ran: false, planned: 0, delivered: { ...NOTHING_DELIVERED } };
    return { ran: true, planned, delivered: await this.deliver(now) };
  }

  // ---- deciding

  /** Writes the reminders that are due at `now` and not written yet. Answers how many rows it wrote. */
  async plan(now: Date): Promise<number> {
    const heads = new Map<string, Promise<string[]>>();
    let planned = 0;
    let cursor: string | undefined;
    for (;;) {
      // Asked again for every batch: a switch turned off in the middle of a tick stops it.
      if (!(await this.flags.isEnabled(REMINDERS_SWITCH))) break;
      const steps: StepRow[] = await this.prisma.procRecordStep.findMany({
        where: {
          status: { in: [...COUNTED_STEP_STATUSES] },
          // A colour at all: the green band starts first. The instant is the application's clock, never the database's.
          greenFrom: { lte: now },
          recordFlow: clockRuns(),
          ...(this.onlyRecordIds ? { recordId: { in: this.onlyRecordIds } } : {}),
        },
        select: STEP_SELECT,
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (steps.length === 0) break;
      cursor = steps[steps.length - 1].id;
      for (const step of steps) {
        try {
          planned += await this.planStep(step, now, heads);
        } catch (error) {
          // One step that cannot be planned must not silence the others; it is looked at again by the next tick.
          this.logger.warn(`Planning the reminders of step ${step.id} failed: ${String(error)}`);
        }
      }
      if (steps.length < BATCH) break;
    }
    return planned;
  }

  private async planStep(step: StepRow, now: Date, heads: Map<string, Promise<string[]>>): Promise<number> {
    const band = bandOfStep(step, now);
    if (band === null) return 0;
    const dueAt = effectiveDue(step) as Date;
    const today = civilDayOf(now);
    const wanted = new Map<string, Wanted>();
    const want = (recipientId: string, kind: ReminderKind, what: string) => {
      const dedupeKey = `${step.id}:${step.deadlineRevision}:${what}:${recipientId}`;
      if (!wanted.has(dedupeKey)) wanted.set(dedupeKey, { recipientId, kind, dedupeKey });
    };

    // The people who answer for the work (MAIN, CHECK) first: somebody who is one of them is not also "informed".
    const responsible = await this.responsible(step, ['MAIN', 'CHECK'], heads);
    for (const userId of responsible) want(userId, REMINDER_KIND.BAND, band === 'OVERDUE' ? `OVERDUE:${today}` : band);
    for (const userId of await this.responsible(step, ['INFORM'], heads)) {
      if (!responsible.includes(userId)) want(userId, REMINDER_KIND.BAND, band);
    }

    if (band === 'OVERDUE') {
      const overdueDays = today - civilDayOf(dueAt);
      const { escalateAfterDays, escalateLeadershipAfterDays } = step.step;
      if (escalateAfterDays !== null && overdueDays >= escalateAfterDays) {
        for (const party of step.parties) {
          if (party.role !== 'MAIN' || !party.team?.parentId) continue;
          for (const userId of await this.headsOf(party.team.parentId, heads)) want(userId, REMINDER_KIND.ESCALATE_PARENT, REMINDER_KIND.ESCALATE_PARENT);
        }
      }
      if (escalateLeadershipAfterDays !== null && overdueDays >= escalateLeadershipAfterDays) {
        const leaders = await this.prisma.user.findMany({ where: { AND: [{ isActive: true }, userHoldingPermission('approve', 'ProcessingStep')] }, select: { id: true } });
        for (const leader of leaders) want(leader.id, REMINDER_KIND.ESCALATE_LEADERSHIP, REMINDER_KIND.ESCALATE_LEADERSHIP);
      }
    }
    if (wanted.size === 0) return 0;

    // What is already decided is not asked about again: after the first tick of a band this is the whole cost of a step.
    const decided = await this.prisma.procReminder.findMany({ where: { dedupeKey: { in: [...wanted.keys()] } }, select: { dedupeKey: true } });
    for (const row of decided) wanted.delete(row.dedupeKey);
    if (wanted.size === 0) return 0;

    const readers = await this.readers(step.recordKind, step.recordId, [...new Set([...wanted.values()].map((row) => row.recipientId))]);
    const rows = [...wanted.values()].filter((row) => readers.has(row.recipientId));
    if (rows.length === 0) return 0;

    const payload = await this.payloadOf(step, now);
    return this.prisma.$transaction(async (tx) => {
      // The step as it is NOW: done, skipped or given another deadline since it was read = nothing to say about it.
      const current = await tx.procRecordStep.findFirst({ where: { id: step.id, status: { in: [...COUNTED_STEP_STATUSES] }, deadlineRevision: step.deadlineRevision }, select: { id: true } });
      if (!current) return 0;
      const written = await tx.procReminder.createMany({
        data: rows.map((row) => ({
          dedupeKey: row.dedupeKey,
          recordStepId: step.id,
          recordKind: step.recordKind,
          recordId: step.recordId,
          stepKey: step.stepKey,
          kind: row.kind,
          band,
          deadlineRevision: step.deadlineRevision,
          recipientId: row.recipientId,
          payload: payload as unknown as Prisma.InputJsonValue,
          // The application's clock, never the column default: the database's NOW() is not the clock rows are claimed by.
          availableAt: now,
          createdAt: now,
        })),
        // Two writers of the same key (it cannot happen under the lock of the tick): the second adds nothing.
        skipDuplicates: true,
      });
      return written.count;
    });
  }

  /** The people who answer for the parties of these roles: the person named, otherwise the active heads of the unit. */
  private async responsible(step: Pick<StepRow, 'parties'>, roles: readonly string[], heads: Map<string, Promise<string[]>>): Promise<string[]> {
    const people = new Set<string>();
    for (const party of step.parties) {
      if (!roles.includes(party.role)) continue;
      if (party.assigneeUserId) people.add(party.assigneeUserId);
      else if (party.teamId) for (const userId of await this.headsOf(party.teamId, heads)) people.add(userId);
    }
    return [...people];
  }

  /** The active heads of an ACTIVE unit. Remembered for the length of one tick. */
  private headsOf(teamId: string, heads: Map<string, Promise<string[]>>): Promise<string[]> {
    let found = heads.get(teamId);
    if (!found) {
      found = this.prisma.userTeam
        .findMany({ where: { teamId, isLeader: true, user: { isActive: true }, team: { status: 'ACTIVE' } }, select: { userId: true }, orderBy: { userId: 'asc' } })
        .then((rows) => rows.map((row) => row.userId));
      heads.set(teamId, found);
    }
    return found;
  }

  /** Of these people, the active ones who may open the record: the rule of the route that shows the flow of a record. */
  private async readers(kind: RecordKind, recordId: string, userIds: string[]): Promise<Set<string>> {
    const readers = new Set<string>();
    if (userIds.length === 0) return readers;
    const people = await this.prisma.user.findMany({ where: { id: { in: this.onlyUserIds ? userIds.filter((userId) => this.onlyUserIds?.includes(userId)) : userIds }, isActive: true }, select: { id: true, canDispatch: true, role: { select: { name: true } } } });
    for (const person of people) {
      try {
        if (await this.gateway.canRead(kind, recordId, { id: person.id, role: person.role?.name ?? '', canDispatch: person.canDispatch }, { viaStep: true })) readers.add(person.id);
      } catch (error) {
        // It cannot be told: not told now. A notice not sent is decided again by the next tick; one sent cannot be taken back.
        this.logger.warn(`Whether ${person.id} may read ${kind} ${recordId} could not be told: ${String(error)}`);
      }
    }
    return readers;
  }

  private async payloadOf(step: Pick<StepRow, 'recordKind' | 'recordId' | 'regulatoryDueAt' | 'internalDueAt' | 'step'>, now: Date, extra: Partial<ReminderPayload> = {}): Promise<ReminderPayload> {
    const snapshot = await this.gateway.load(step.recordKind, step.recordId);
    const dueAt = effectiveDue(step);
    return { stepName: step.step.name, recordCode: snapshot?.code ?? null, dueAt: dueAt?.toISOString() ?? null, remainingDays: dueAt ? civilDayOf(dueAt) - civilDayOf(now) : null, ...extra };
  }

  // ---- delivering

  /** Delivers up to `max` waiting rows, one at a time. `now` is the application's clock rows are claimed by. */
  async deliver(now: Date = new Date(), max = 200): Promise<DeliverResult> {
    const result: DeliverResult = { ...NOTHING_DELIVERED };
    for (let n = 0; n < max; n++) {
      // Checked before EVERY claim: switched off, what waits keeps waiting.
      if (!(await this.flags.isEnabled(REMINDERS_SWITCH))) break;
      const outcome = await this.deliverOne(now);
      if (outcome === null) break;
      if (outcome === REMINDER_OUTCOME.SENT) result.sent += 1;
      else if (outcome === 'RETRY') result.retried += 1;
      else if (outcome === 'DEAD') result.dead += 1;
      else result.dropped += 1;
    }
    return result;
  }

  /**
   * One waiting row, delivered and marked DONE in ONE transaction that holds the row (`FOR UPDATE SKIP LOCKED`): two
   * workers never take the same row, and the notification exists exactly when the row is DONE.
   */
  private async deliverOne(now: Date): Promise<ReminderOutcome | 'RETRY' | 'DEAD' | null> {
    let claimed: { id: string; attempts: number } | null = null;
    let bell: string | null = null;
    try {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          const only = this.onlyRecordIds ? Prisma.sql`AND "recordId" IN (${Prisma.join(this.onlyRecordIds.length > 0 ? this.onlyRecordIds : [''])})` : Prisma.empty;
          const rows = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "proc_reminders"
            WHERE status = 'PENDING' AND "availableAt" <= ${now} ${only}
            ORDER BY "availableAt", id
            LIMIT 1
            FOR UPDATE SKIP LOCKED`;
          if (rows.length === 0) return null;
          const row = await tx.procReminder.findUniqueOrThrow({ where: { id: rows[0].id } });
          claimed = { id: row.id, attempts: row.attempts };
          const notice = await this.noticeOf(row);
          const sent = typeof notice === 'string' ? notice : (await this.notifications.deliverInApp(notice, tx)) ? REMINDER_OUTCOME.SENT : REMINDER_OUTCOME.SUPPRESSED;
          await tx.procReminder.update({ where: { id: row.id }, data: { status: 'DONE', outcome: sent, processedAt: now, attempts: { increment: 1 }, lastError: null } });
          if (sent === REMINDER_OUTCOME.SENT) bell = row.recipientId;
          return sent;
        },
        { timeout: 30_000 },
      );
      // After the commit: the screen that hears the bell must find the row.
      if (bell) this.notifications.ringBell(bell);
      return outcome;
    } catch (error) {
      const failed = claimed as { id: string; attempts: number } | null;
      if (!failed) throw error;
      return this.fail(failed.id, failed.attempts + 1, error, now);
    }
  }

  /** The notice a row becomes, or why it becomes none. Everything is asked again NOW: a row may have waited. */
  private async noticeOf(row: Prisma.ProcReminderGetPayload<object>): Promise<InAppNotice | ReminderOutcome> {
    const kind = row.recordKind;
    const person = await this.prisma.user.findFirst({ where: { id: row.recipientId, isActive: true }, select: { id: true } });
    if (!person) return REMINDER_OUTCOME.RECIPIENT_GONE;
    const step = await this.prisma.procRecordStep.findFirst({
      where: { id: row.recordStepId, status: { in: [...COUNTED_STEP_STATUSES] }, recordFlow: clockRuns() },
      select: { deadlineRevision: true },
    });
    // Done, skipped, replaced, paused, finished, or (for a reminder about a deadline) given another deadline since.
    if (!step || (row.kind !== REMINDER_KIND.NUDGE && step.deadlineRevision !== row.deadlineRevision)) return REMINDER_OUTCOME.STALE;
    if (!(await this.readers(kind, row.recordId, [row.recipientId])).has(row.recipientId)) return REMINDER_OUTCOME.NOT_READABLE;

    const payload = (row.payload ?? {}) as unknown as Partial<ReminderPayload>;
    const overdue = row.band === 'OVERDUE';
    const idKey = kind === 'PETITION' ? 'petitionId' : kind === 'INCIDENT' ? 'incidentId' : 'caseId';
    return {
      toUserId: row.recipientId,
      type: row.kind === REMINDER_KIND.NUDGE ? NotificationType.SYSTEM : NOTICE_TYPE[kind][overdue ? 'overdue' : 'near'],
      ...wording(row.kind as ReminderKind, kind, row.band, payload),
      link: stepLink(kind, row.recordId),
      metadata: { [idKey]: row.recordId, stepKey: row.stepKey, reminderId: row.id, reminderKind: row.kind, band: row.band },
    };
  }

  private async fail(id: string, attempts: number, error: unknown, now: Date): Promise<'RETRY' | 'DEAD'> {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, MAX_ERROR_LENGTH);
    const dead = attempts >= MAX_REMINDER_ATTEMPTS;
    const wait = Math.min(FIRST_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
    await this.prisma.procReminder.update({
      where: { id },
      data: dead ? { status: 'DEAD', attempts, lastError, processedAt: now } : { attempts, lastError, availableAt: new Date(now.getTime() + wait) },
    });
    if (dead) this.logger.error(`Delivering reminder ${id} gave up after ${attempts} attempts: ${lastError}`);
    return dead ? 'DEAD' : 'RETRY';
  }

  // ---- nudging

  /**
   * A person presses the people who answer for a step being worked, with a short message: they are told now, and the
   * nudge stays in the history of the step. The caller has already checked that the actor may read the record.
   */
  async nudge(actorId: string, kind: RecordKind, recordId: string, stepKey: string, message: string, now: Date = new Date()): Promise<{ notified: number }> {
    if (!(await this.flags.isEnabled(REMINDERS_SWITCH)) || !(await this.flags.isEnabled(RECORDS_SWITCH))) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND });
    const text = (message ?? '').trim();
    if (text === '' || text.length > MAX_NUDGE_MESSAGE) throw new BadRequestException({ code: PROCESSING_ERROR.STEP_REASON_REQUIRED });
    const step = await this.prisma.procRecordStep.findFirst({ where: { recordKind: kind, recordId, stepKey }, select: STEP_SELECT });
    if (!step) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_STEP_NOT_FOUND });
    if (!(COUNTED_STEP_STATUSES as readonly string[]).includes(step.status)) throw new ConflictException({ code: PROCESSING_ERROR.STEP_NOT_OPEN });

    const responsible = (await this.responsible(step, ['MAIN', 'CHECK'], new Map())).filter((userId) => userId !== actorId);
    const readers = await this.readers(kind, recordId, responsible);
    const recipients = responsible.filter((userId) => readers.has(userId));
    const payload = await this.payloadOf(step, now, { message: text, byUserId: actorId });
    const nudgeId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      if (recipients.length > 0) {
        await tx.procReminder.createMany({
          data: recipients.map((recipientId) => ({
            dedupeKey: `${step.id}:${REMINDER_KIND.NUDGE}:${nudgeId}:${recipientId}`,
            recordStepId: step.id,
            recordKind: kind,
            recordId,
            stepKey,
            kind: REMINDER_KIND.NUDGE,
            band: null,
            deadlineRevision: step.deadlineRevision,
            recipientId,
            payload: payload as unknown as Prisma.InputJsonValue,
            availableAt: now,
            createdAt: now,
          })),
        });
      }
      // Metadata only: who, when, the words, how many were told.
      await tx.procStepChange.create({ data: { recordFlowId: step.recordFlowId, recordKind: kind, recordId, stepKey, action: STEP_NUDGED, toValue: { notified: recipients.length }, reason: text, actorId, at: now } });
    });
    try {
      await this.deliver(now);
    } catch (error) {
      // Written already: the next tick delivers it.
      this.logger.warn(`Delivering a nudge failed, the tick will: ${String(error)}`);
    }
    return { notified: recipients.length };
  }
}

/** The band of a step at `now`, or `null` when it shows no colour (no deadline, or not near it yet). */
function bandOfStep(step: Pick<StepRow, 'regulatoryDueAt' | 'internalDueAt' | 'redFrom' | 'yellowFrom' | 'greenFrom'>, now: Date): Exclude<Band, 'NONE'> | null {
  const dueAt = effectiveDue(step);
  if (!dueAt || !step.redFrom || !step.yellowFrom || !step.greenFrom) return null;
  const band = bandAt(now, { dueAt, redFrom: step.redFrom, yellowFrom: step.yellowFrom, greenFrom: step.greenFrom });
  return band === 'NONE' ? null : band;
}

/** The existing notification types of a deadline, per kind of record: a person's preferences for them keep working. */
const NOTICE_TYPE: Record<RecordKind, { near: NotificationType; overdue: NotificationType }> = {
  PETITION: { near: NotificationType.PETITION_DEADLINE_NEAR, overdue: NotificationType.PETITION_OVERDUE },
  INCIDENT: { near: NotificationType.INCIDENT_DEADLINE_NEAR, overdue: NotificationType.INCIDENT_OVERDUE },
  CASE: { near: NotificationType.CASE_DEADLINE_NEAR, overdue: NotificationType.CASE_OVERDUE },
};

const RECORD_NOUN: Record<RecordKind, string> = { PETITION: 'đơn thư', INCIDENT: 'vụ việc', CASE: 'vụ án' };
const BAND_NAME: Record<string, string> = { RED: 'Đỏ', YELLOW: 'Vàng', GREEN: 'Xanh' };

/**
 * The words of a notice. Vietnamese text written by the server, as every notification of this system is (a
 * notification row stores its title and message; there is no code a client could translate).
 */
function wording(kind: ReminderKind, recordKind: RecordKind, band: string | null, payload: Partial<ReminderPayload>): { title: string; message: string } {
  const what = `Bước "${payload.stepName ?? ''}" của ${RECORD_NOUN[recordKind]}${payload.recordCode ? ` ${payload.recordCode}` : ''}`;
  const days = payload.remainingDays ?? 0;
  const late = days < 0 ? `đã quá hạn ${-days} ngày` : 'đã quá hạn';
  if (kind === REMINDER_KIND.NUDGE) return { title: 'Đôn đốc xử lý', message: `${what}: ${payload.message ?? ''}` };
  if (kind === REMINDER_KIND.ESCALATE_PARENT || kind === REMINDER_KIND.ESCALATE_LEADERSHIP) return { title: 'Bước xử lý quá hạn chưa được giải quyết', message: `${what} ${late}, chưa được giải quyết` };
  if (band === 'OVERDUE') return { title: 'Bước xử lý đã quá hạn', message: `${what} ${late}` };
  const left = days <= 0 ? 'đến hạn hôm nay' : `còn ${days} ngày`;
  return { title: 'Bước xử lý sắp đến hạn', message: `${what} ${left} (mức ${BAND_NAME[band ?? ''] ?? band ?? ''})` };
}
