import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, Prisma } from '@prisma/client';
import { userHoldingPermission } from '../../authz/enforcement';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
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

const FIRST_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;
export const MAX_REMINDER_ATTEMPTS = 8;
const MAX_ERROR_LENGTH = 500;
export const MAX_NUDGE_MESSAGE = 500;
/** The longest one batch of planning may hold its advisory lock. */
const BATCH_TIMEOUT_MS = 2 * 60 * 1000;
/** A claimed row that never finished (the process died) is taken again after this long. */
const LEASE_MS = 5 * 60 * 1000;
/** One nudge per person and step per window of this length. */
export const NUDGE_COOLDOWN_MS = 30 * 60 * 1000;
/** The row a nudge leaves to hold its window: never delivered. */
export const NUDGE_MARK = 'NUDGE_MARK';
/** A nudge delivers at most this many of its own notices inline; the tick delivers the rest. */
const MAX_INLINE_DELIVERIES = 20;
export const DEFAULT_ESCALATE_PARENT_DAYS = 3;
export const DEFAULT_ESCALATE_LEADERSHIP_DAYS = 7;

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
  /** The civil day of a reminder repeated daily: it is true on that day only. */
  day?: number;
}

type ReminderRow = Prisma.ProcReminderGetPayload<object>;

interface PlanContext {
  heads: Map<string, Promise<string[]>>;
  /** After how many civil days overdue a step escalates when its flow does not say; `null`: never. */
  escalation: { parent: number | null; leadership: number | null };
}

interface ReminderPayload {
  stepName: string;
  recordCode: string | null;
  dueAt: string | null;
  /** Civil days (Vietnam) from the day the reminder was decided to the due day: 0 on it, negative after it. */
  remainingDays: number | null;
  /** Set for a reminder repeated daily (OVERDUE): the civil day it was decided for. */
  day?: number;
  message?: string;
  byUserId?: string;
}

export interface TickResult {
  /** `false`: the switch is off. Nothing was read or written. */
  ran: boolean;
  /** DONE: the whole scan. PARTIAL: the budget ran out (or the switch went off); the next tick goes on. BUSY: another runner plans. */
  planning: 'OFF' | 'DONE' | 'PARTIAL' | 'BUSY' | 'FAILED';
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
 * green ones it passed, and a reminder that waited until its band (or, for the daily one, its day) was over is dropped
 * when it is delivered. A band is reminded once; OVERDUE once every civil day (Vietnam). A new deadline
 * (`deadlineRevision` goes up with every change, so A -> B -> A too) is reminded again.
 *
 * WHO. For the MAIN and CHECK parties of the step: the person named, otherwise the active heads of the (active) unit.
 * INFORM parties are told once per band, never daily. Escalation, after the civil days overdue the step of the flow
 * says (`escalateAfterDays`, `escalateLeadershipAfterDays`) or, when it says nothing, the two system settings
 * (defaults 3 and 7; 0 or empty = never): once the heads of the PARENT unit of the main unit, and once the people who
 * hold `approve:ProcessingStep`. Every recipient must be an active person who may OPEN the record
 * (`RecordGateway.canRead`, the rule of the route that shows the flow of a record); the answer is asked again when
 * delivering. Only an answer is an answer: an ERROR while asking is retried, never taken for "no".
 *
 * HOW (C12). One row of `proc_reminders` per reminder and recipient is BOTH the mark "decided" (a unique key: step +
 * deadline revision + band or level + recipient, + the civil day for the daily one) and the work "deliver it". The rows
 * of a step are written in one transaction. A worker claims a row with a lease (a short transaction), reads everything
 * the notice needs WITHOUT holding a transaction, and then writes the notification and the mark DONE in one short
 * transaction that holds the row: a process that dies anywhere leaves either both or neither.
 *
 * THE SWITCH is read from its row (never from a cache) before every batch of planning and before every claim: turned
 * off, every runner stops at its next step. Off: nothing is read or written, rows already written wait, and the legacy
 * deadline reminder speaks for every record again (`DeadlineScheduler.managedExclusions`).
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
  /** The row of `feature_flags` that is the switch. Another row only in the specs (the real one is shared). */
  switchKey: string = REMINDERS_SWITCH;
  /** How much one tick plans: steps per lock, steps per tick, time per tick. What is left is the next tick's. */
  batchSize = 100;
  stepBudget = 2000;
  timeBudgetMs = 5 * 60 * 1000;
  /** Where the scan stopped when a tick ran out of budget; `undefined`: from the start. */
  private cursor: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly gateway: RecordGateway,
    private readonly notifications: NotificationEventService,
  ) {}

  /** The switch as its row says NOW. No cache: another runner must stop within one step of it being turned off. */
  async switchedOn(): Promise<boolean> {
    const row = await this.prisma.featureFlag.findUnique({ where: { key: this.switchKey }, select: { enabled: true } });
    return row?.enabled === true;
  }

  @Cron('*/15 * * * *', { name: LOCK_KEY })
  async run(): Promise<void> {
    try {
      await this.tick(new Date());
    } catch (error) {
      this.logger.warn(`The reminder tick failed: ${String(error)}`);
    }
  }

  /**
   * One tick at `now`: decide the reminders that are due (as far as the budget goes), then deliver what waits.
   * Delivery ALWAYS runs while the switch is on, whatever became of the planning.
   */
  async tick(now: Date): Promise<TickResult> {
    if (!(await this.switchedOn())) return { ran: false, planning: 'OFF', planned: 0, delivered: { ...NOTHING_DELIVERED } };
    let planned = 0;
    let planning: TickResult['planning'] = 'FAILED';
    try {
      ({ planned, state: planning } = await this.plan(now));
    } catch (error) {
      this.logger.warn(`Planning the reminders failed, delivering what waits: ${String(error)}`);
    }
    return { ran: true, planning, planned, delivered: await this.deliver(now) };
  }

  // ---- deciding

  /**
   * Writes the reminders that are due at `now` and not written yet, batch by batch. Each batch is planned under a
   * short advisory lock of its own (one runner plans a batch at a time; nothing is held across the scan), and the tick
   * stops when its budget is spent: the cursor stays, and the next tick goes on from there.
   */
  async plan(now: Date): Promise<{ planned: number; state: 'DONE' | 'PARTIAL' | 'BUSY' }> {
    const started = Date.now();
    const context: PlanContext = { heads: new Map(), escalation: await this.escalationDefaults() };
    let planned = 0;
    let seen = 0;
    for (;;) {
      if (!(await this.switchedOn())) return { planned, state: 'PARTIAL' };
      if (seen >= this.stepBudget || Date.now() - started >= this.timeBudgetMs) return { planned, state: 'PARTIAL' };
      const batch = await this.planBatch(now, context);
      if (batch === null) return { planned, state: 'BUSY' };
      planned += batch.planned;
      seen += batch.steps;
      if (batch.end) {
        this.cursor = undefined;
        return { planned, state: 'DONE' };
      }
    }
  }

  /** One batch under the lock. `null`: another runner holds it. The lock connection runs nothing but the lock. */
  private planBatch(now: Date, context: PlanContext): Promise<{ steps: number; planned: number; end: boolean } | null> {
    return this.prisma.$transaction(
      async (lock) => {
        const [row] = await lock.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${LOCK_KEY})) AS locked`;
        if (!row?.locked) return null;
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
          take: this.batchSize,
          ...(this.cursor ? { cursor: { id: this.cursor }, skip: 1 } : {}),
        });
        let planned = 0;
        for (const step of steps) {
          try {
            planned += await this.planStep(step, now, context);
          } catch (error) {
            // One step that cannot be planned (an error while asking who may read, say) must not silence the others:
            // nothing was written for it, so the next tick plans it again.
            this.logger.warn(`Planning the reminders of step ${step.id} failed: ${String(error)}`);
          }
        }
        if (steps.length > 0) this.cursor = steps[steps.length - 1].id;
        return { steps: steps.length, planned, end: steps.length < this.batchSize };
      },
      { timeout: BATCH_TIMEOUT_MS, maxWait: 10_000 },
    );
  }

  /**
   * After how many civil days overdue a step escalates when its flow does not say: the two system settings. A missing
   * row or a value that is not a number: the default. 0 or empty: never.
   */
  private async escalationDefaults(): Promise<PlanContext['escalation']> {
    const read = async (key: string, fallback: number): Promise<number | null> => {
      const row = await this.prisma.systemSetting.findUnique({ where: { key }, select: { value: true } });
      if (!row) return fallback;
      const text = (row.value ?? '').trim();
      if (text === '') return null;
      const days = Number(text);
      if (!Number.isInteger(days) || days < 0) return fallback;
      return days === 0 ? null : days;
    };
    return {
      parent: await read(SETTINGS_KEY.NHAC_VIEC_DON_DOC_CAP_TREN_NGAY, DEFAULT_ESCALATE_PARENT_DAYS),
      leadership: await read(SETTINGS_KEY.NHAC_VIEC_DON_DOC_LANH_DAO_NGAY, DEFAULT_ESCALATE_LEADERSHIP_DAYS),
    };
  }

  private async planStep(step: StepRow, now: Date, context: PlanContext): Promise<number> {
    const { heads } = context;
    const band = bandOfStep(step, now);
    if (band === null) return 0;
    const dueAt = effectiveDue(step) as Date;
    const today = civilDayOf(now);
    const wanted = new Map<string, Wanted>();
    const want = (recipientId: string, kind: ReminderKind, what: string, day?: number) => {
      const dedupeKey = `${step.id}:${step.deadlineRevision}:${what}:${recipientId}`;
      if (!wanted.has(dedupeKey)) wanted.set(dedupeKey, { recipientId, kind, dedupeKey, day });
    };

    // The people who answer for the work (MAIN, CHECK) first: somebody who is one of them is not also "informed".
    const responsible = await this.responsible(step, ['MAIN', 'CHECK'], heads);
    for (const userId of responsible) {
      if (band === 'OVERDUE') want(userId, REMINDER_KIND.BAND, `OVERDUE:${today}`, today);
      else want(userId, REMINDER_KIND.BAND, band);
    }
    for (const userId of await this.responsible(step, ['INFORM'], heads)) {
      if (!responsible.includes(userId)) want(userId, REMINDER_KIND.BAND, band);
    }

    if (band === 'OVERDUE') {
      const overdueDays = today - civilDayOf(dueAt);
      // What the step of the flow says wins; when it says nothing, the system settings.
      const parentAfter = step.step.escalateAfterDays ?? context.escalation.parent;
      const leadershipAfter = step.step.escalateLeadershipAfterDays ?? context.escalation.leadership;
      if (parentAfter !== null && overdueDays >= parentAfter) {
        for (const party of step.parties) {
          if (party.role !== 'MAIN' || !party.team?.parentId) continue;
          for (const userId of await this.headsOf(party.team.parentId, heads)) want(userId, REMINDER_KIND.ESCALATE_PARENT, REMINDER_KIND.ESCALATE_PARENT);
        }
      }
      if (leadershipAfter !== null && overdueDays >= leadershipAfter) {
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
          payload: { ...payload, ...(row.day === undefined ? {} : { day: row.day }) } as unknown as Prisma.InputJsonValue,
          // The application's clock, never the column default: the database's NOW() is not the clock rows are claimed by.
          availableAt: now,
          createdAt: now,
        })),
        // Two writers of the same key: the second adds nothing.
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

  /**
   * Of these people, the active ones who may open the record: the rule of the route that shows the flow of a record.
   * Only an explicit "no" leaves a person out. An error while asking is thrown: the caller plans the step again at the
   * next tick, or retries the delivery; it is never recorded as a refusal.
   */
  private async readers(kind: RecordKind, recordId: string, userIds: string[]): Promise<Set<string>> {
    const readers = new Set<string>();
    const asked = this.onlyUserIds ? userIds.filter((userId) => this.onlyUserIds?.includes(userId)) : userIds;
    if (asked.length === 0) return readers;
    const people = await this.prisma.user.findMany({ where: { id: { in: asked }, isActive: true }, select: { id: true, canDispatch: true, role: { select: { name: true } } } });
    for (const person of people) {
      if (await this.gateway.canRead(kind, recordId, { id: person.id, role: person.role?.name ?? '', canDispatch: person.canDispatch }, { viaStep: true })) readers.add(person.id);
    }
    return readers;
  }

  private async payloadOf(step: Pick<StepRow, 'recordKind' | 'recordId' | 'regulatoryDueAt' | 'internalDueAt' | 'step'>, now: Date, extra: Partial<ReminderPayload> = {}): Promise<ReminderPayload> {
    const snapshot = await this.gateway.load(step.recordKind, step.recordId);
    const dueAt = effectiveDue(step);
    return { stepName: step.step.name, recordCode: snapshot?.code ?? null, dueAt: dueAt?.toISOString() ?? null, remainingDays: dueAt ? civilDayOf(dueAt) - civilDayOf(now) : null, ...extra };
  }

  // ---- delivering

  /**
   * Delivers up to `max` waiting rows, one at a time. `now` is the application's clock: rows are claimed by it, and a
   * reminder is judged against it (its band, its day). `onlyIds`: these rows and no others (a nudge delivers its own).
   */
  async deliver(now: Date = new Date(), max = 200, onlyIds?: string[]): Promise<DeliverResult> {
    const result: DeliverResult = { ...NOTHING_DELIVERED };
    for (let n = 0; n < max; n++) {
      // Read from the row before EVERY claim: switched off, what waits keeps waiting, in every runner.
      if (!(await this.switchedOn())) break;
      const outcome = await this.deliverOne(now, onlyIds);
      if (outcome === null) break;
      if (outcome === REMINDER_OUTCOME.SENT) result.sent += 1;
      else if (outcome === 'RETRY') result.retried += 1;
      else if (outcome === 'DEAD') result.dead += 1;
      else result.dropped += 1;
    }
    return result;
  }

  /**
   * One waiting row. Three steps, and no transaction is open while anything else is read:
   *   1. claim it with a lease (short transaction): nobody else takes it until the lease runs out;
   *   2. read what the notice needs (the step, who may read, the case policy, the preferences) on the root client;
   *   3. write the notification and the mark DONE in ONE short transaction that holds the row and checks it is still
   *      waiting: the notification exists exactly when the row is DONE.
   */
  private async deliverOne(now: Date, onlyIds?: string[]): Promise<ReminderOutcome | 'RETRY' | 'DEAD' | null> {
    const row = await this.claim(now, onlyIds);
    if (!row) return null;
    try {
      const decided = await this.noticeOf(row, now);
      const prepared = typeof decided === 'string' ? null : await this.notifications.prepareInApp(decided);
      const outcome: ReminderOutcome = typeof decided === 'string' ? decided : prepared ? REMINDER_OUTCOME.SENT : REMINDER_OUTCOME.SUPPRESSED;
      const written = await this.prisma.$transaction(async (tx) => {
        const waiting = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "proc_reminders" WHERE id = ${row.id} AND status = 'PENDING' FOR UPDATE`;
        // Finished by another worker after the lease ran out: nothing to add.
        if (waiting.length === 0) return false;
        if (prepared) await this.notifications.writeInApp(prepared, tx);
        await tx.procReminder.update({ where: { id: row.id }, data: { status: 'DONE', outcome, processedAt: now, lastError: null } });
        return true;
      });
      if (!written) return REMINDER_OUTCOME.STALE;
      // After the commit: the screen that hears the bell must find the row.
      if (prepared) this.notifications.ringBell(row.recipientId);
      return outcome;
    } catch (error) {
      return this.fail(row.id, row.attempts, error, now);
    }
  }

  /** One waiting row, leased until `now` + the lease. The application's clock, never the database's. */
  private claim(now: Date, onlyIds?: string[]): Promise<ReminderRow | null> {
    const records = this.onlyRecordIds ? Prisma.sql`AND "recordId" IN (${Prisma.join(this.onlyRecordIds.length > 0 ? this.onlyRecordIds : [''])})` : Prisma.empty;
    const ids = onlyIds ? Prisma.sql`AND id IN (${Prisma.join(onlyIds.length > 0 ? onlyIds : [''])})` : Prisma.empty;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "proc_reminders"
        WHERE status = 'PENDING' AND "availableAt" <= ${now} ${records} ${ids}
        ORDER BY "availableAt", id
        LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return null;
      return tx.procReminder.update({ where: { id: rows[0].id }, data: { attempts: { increment: 1 }, availableAt: new Date(now.getTime() + LEASE_MS) } });
    });
  }

  /**
   * The notice a row becomes, or why it becomes none. Everything is asked again at `now`: a row may have waited (the
   * switch was off, a delivery failed), and a reminder says "the step is in this band today", which must still be true.
   */
  private async noticeOf(row: ReminderRow, now: Date): Promise<InAppNotice | ReminderOutcome> {
    const kind = row.recordKind;
    const person = await this.prisma.user.findFirst({ where: { id: row.recipientId, isActive: true }, select: { id: true } });
    if (!person) return REMINDER_OUTCOME.RECIPIENT_GONE;
    const step = await this.prisma.procRecordStep.findFirst({
      where: { id: row.recordStepId, status: { in: [...COUNTED_STEP_STATUSES] }, recordFlow: clockRuns() },
      select: { deadlineRevision: true, regulatoryDueAt: true, internalDueAt: true, redFrom: true, yellowFrom: true, greenFrom: true },
    });
    // Done, skipped, replaced, paused or finished since.
    if (!step) return REMINDER_OUTCOME.STALE;
    const payload = (row.payload ?? {}) as unknown as Partial<ReminderPayload>;
    if (row.kind !== REMINDER_KIND.NUDGE) {
      // Another deadline, another band, or (the daily reminder) another day: what the row says is no longer true.
      if (step.deadlineRevision !== row.deadlineRevision) return REMINDER_OUTCOME.STALE;
      if (bandOfStep(step, now) !== row.band) return REMINDER_OUTCOME.STALE;
      if (typeof payload.day === 'number' && payload.day !== civilDayOf(now)) return REMINDER_OUTCOME.STALE;
    }
    if (!(await this.readers(kind, row.recordId, [row.recipientId])).has(row.recipientId)) return REMINDER_OUTCOME.NOT_READABLE;

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
    // Only a row that still waits: one finished meanwhile stays finished.
    await this.prisma.procReminder.updateMany({
      where: { id, status: 'PENDING' },
      data: dead ? { status: 'DEAD', lastError, processedAt: now } : { lastError, availableAt: new Date(now.getTime() + wait) },
    });
    if (dead) this.logger.error(`Delivering reminder ${id} gave up after ${attempts} attempts: ${lastError}`);
    return dead ? 'DEAD' : 'RETRY';
  }

  // ---- nudging

  /**
   * A person presses the people who answer for a step being worked, with a short message: they are told now, and the
   * nudge stays in the history of the step. The caller has already checked that the actor may read the record.
   *
   * ONE nudge per person and step per window of 30 minutes. What enforces it is a unique key: the nudge writes a mark
   * row whose key carries the actor, the step and the window, in the same transaction as everything else, so two
   * requests at once cannot both pass. `idempotencyKey`: the same request sent again (a client that lost the answer)
   * gets the first answer and does nothing.
   */
  async nudge(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: { message: string; idempotencyKey?: string }, now: Date = new Date()): Promise<{ notified: number }> {
    if (!(await this.switchedOn()) || !(await this.flags.isEnabled(RECORDS_SWITCH))) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_FLOW_NOT_FOUND });
    const text = (input.message ?? '').trim();
    if (text === '' || text.length > MAX_NUDGE_MESSAGE) throw new BadRequestException({ code: PROCESSING_ERROR.STEP_REASON_REQUIRED });
    const idempotencyKey = input.idempotencyKey;
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey))) throw new BadRequestException({ code: PROCESSING_ERROR.IDEMPOTENCY_KEY_INVALID });
    const step = await this.prisma.procRecordStep.findFirst({ where: { recordKind: kind, recordId, stepKey }, select: STEP_SELECT });
    if (!step) throw new NotFoundException({ code: PROCESSING_ERROR.RECORD_STEP_NOT_FOUND });

    const marks = { recordStepId: step.id, kind: NUDGE_MARK, recipientId: actorId };
    const firstAnswer = async (): Promise<{ notified: number } | null> => {
      if (!idempotencyKey) return null;
      const mark = await this.prisma.procReminder.findFirst({ where: { ...marks, payload: { path: ['idempotencyKey'], equals: idempotencyKey } }, select: { payload: true } });
      return mark ? { notified: Number((mark.payload as { notified?: number } | null)?.notified ?? 0) } : null;
    };
    const tooSoon = () => new HttpException({ code: PROCESSING_ERROR.NUDGE_TOO_SOON }, HttpStatus.TOO_MANY_REQUESTS);
    const replay = await firstAnswer();
    if (replay) return replay;
    if (!(COUNTED_STEP_STATUSES as readonly string[]).includes(step.status)) throw new ConflictException({ code: PROCESSING_ERROR.STEP_NOT_OPEN });
    // The sliding window (a nudge 29 minutes ago in the previous fixed window); the unique key below is what holds
    // when two requests arrive together.
    if (await this.prisma.procReminder.findFirst({ where: { ...marks, createdAt: { gt: new Date(now.getTime() - NUDGE_COOLDOWN_MS) } }, select: { id: true } })) throw tooSoon();

    const responsible = (await this.responsible(step, ['MAIN', 'CHECK'], new Map())).filter((userId) => userId !== actorId);
    const readers = await this.readers(kind, recordId, responsible);
    const recipients = responsible.filter((userId) => readers.has(userId));
    const payload = await this.payloadOf(step, now, { message: text, byUserId: actorId });
    const markKey = `${step.id}:${REMINDER_KIND.NUDGE}:${actorId}:${Math.floor(now.getTime() / NUDGE_COOLDOWN_MS)}`;
    const base = { recordStepId: step.id, recordKind: kind, recordId, stepKey, band: null, deadlineRevision: step.deadlineRevision, availableAt: now, createdAt: now };

    try {
      await this.prisma.$transaction(async (tx) => {
        // The mark: never delivered (it is DONE from the start), it only holds the key of this actor, step and window.
        await tx.procReminder.create({
          data: { ...base, dedupeKey: markKey, kind: NUDGE_MARK, recipientId: actorId, status: 'DONE', outcome: NUDGE_MARK, processedAt: now, payload: { notified: recipients.length, ...(idempotencyKey ? { idempotencyKey } : {}) } },
        });
        if (recipients.length > 0) {
          await tx.procReminder.createMany({
            data: recipients.map((recipientId) => ({ ...base, dedupeKey: `${markKey}:${recipientId}`, kind: REMINDER_KIND.NUDGE, recipientId, payload: payload as unknown as Prisma.InputJsonValue })),
          });
        }
        // Metadata only: who, when, the words, how many were told.
        await tx.procStepChange.create({ data: { recordFlowId: step.recordFlowId, recordKind: kind, recordId, stepKey, action: STEP_NUDGED, toValue: { notified: recipients.length }, reason: text, actorId, at: now } });
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // The key of this window is taken: the same request arriving twice gets the first answer, another one is too soon.
      const first = await firstAnswer();
      if (first) return first;
      throw tooSoon();
    }

    try {
      // Its own rows and no others, and a bounded number inline: the rest is the tick's.
      const own = await this.prisma.procReminder.findMany({ where: { dedupeKey: { in: recipients.map((recipientId) => `${markKey}:${recipientId}`) } }, select: { id: true }, take: MAX_INLINE_DELIVERIES });
      if (own.length > 0) await this.deliver(now, own.length, own.map((row) => row.id));
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
