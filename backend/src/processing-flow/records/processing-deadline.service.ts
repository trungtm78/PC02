import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { bandInstants } from '../engine/bands';
import { computeDue } from '../engine/compute-due';
import { civilDayFromIso, endOfCivilDay } from '../engine/civil-day';
import { ProcessingEngineError } from '../engine/errors';
import type { RecordKind } from '../gateway/record-snapshot';
import { ProcessingCommandService, type CommandInput } from './processing-command.service';
import type { RecordFlowDto } from './record-flow.dto';

const MAX_REASON_LENGTH = 500;

const refuse = {
  bad: (code: ProcessingErrorCode) => new BadRequestException({ code }),
  conflict: (code: ProcessingErrorCode) => new ConflictException({ code }),
};

const earlier = (a: Date, b: Date | null): Date => (b && b.getTime() < a.getTime() ? b : a);

/**
 * The two deadlines of a step have two different owners.
 *
 *   REGULATORY  the deadline the law (or the flow) sets. It moves only by an EXTENSION, as many times and by as much as
 *               the flow allows, with a reason, or by the clock of a suspended record standing still.
 *   INTERNAL    the unit's own target. Never later than the regulatory one: it can only be set earlier, and "back to
 *               the regulatory deadline" is always possible.
 *
 * The colour of a step counts down to the EARLIER of the two. Every change bumps `deadlineRevision` (a reminder names
 * the number it was sent for) and writes the history.
 */
@Injectable()
export class ProcessingDeadlineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: ProcessingCommandService,
  ) {}

  /** Sets the unit's own deadline of a step (a civil day, Vietnam), or takes it back to the regulatory one (`date: null`). */
  async adjustDue(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput & { date: string | null; reason?: string }): Promise<RecordFlowDto> {
    const target = input.date === null ? null : parseDay(input.date);
    const reason = cleanReason(input.reason);
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'ADJUST_DUE', input, async (tx, flow, step) => {
      if (!['OPEN', 'REPORTED'].includes(step.status) || !step.regulatoryDueAt) throw refuse.conflict(PROCESSING_ERROR.STEP_HAS_NO_DEADLINE);
      const regulatory = step.regulatoryDueAt;
      const next = target ?? regulatory;
      if (next.getTime() > regulatory.getTime()) throw refuse.conflict(PROCESSING_ERROR.INTERNAL_DUE_AFTER_REGULATORY);
      if (step.internalDueAt && step.internalDueAt.getTime() === next.getTime()) return;

      const bands = bandInstants(next, step.step);
      await tx.procRecordStep.update({
        where: { id: step.id },
        data: { internalDueAt: next, ...bands, deadlineRevision: { increment: 1 }, revision: { increment: 1 } },
      });
      await this.commands.change(tx, flow, step.stepKey, 'INTERNAL_DUE_SET', { internalDueAt: iso(step.internalDueAt) }, { internalDueAt: next.toISOString() }, reason, actorId);
    });
  }

  /**
   * Extends the regulatory deadline of a step by the duration the flow allows for an extension, counted from the
   * deadline as it stands now. A reason is required. Refused once the allowed number of extensions is used up. A unit's
   * own target that was never set apart from the regulatory deadline moves with it; one the unit set earlier stays.
   */
  async extendStep(actorId: string, kind: RecordKind, recordId: string, stepKey: string, input: CommandInput & { reason: string }): Promise<RecordFlowDto> {
    const reason = cleanReason(input.reason);
    if (!reason) throw refuse.bad(PROCESSING_ERROR.STEP_REASON_REQUIRED);
    return this.commands.writeStep(kind, recordId, actorId, stepKey, 'EXTEND', input, async (tx, flow, step) => {
      if (!['OPEN', 'REPORTED'].includes(step.status) || !step.regulatoryDueAt) throw refuse.conflict(PROCESSING_ERROR.STEP_HAS_NO_DEADLINE);

      // What the flow allows: the variant that was used says so when it names the figure, otherwise the step does.
      const variant = step.variant ? await tx.procFlowStepVariant.findFirst({ where: { stepId: step.stepId, conditionValue: step.variant } }) : null;
      const allowed = variant?.maxExtensions ?? step.step.maxExtensions;
      const value = variant?.extensionValue ?? step.step.extensionValue;
      const unit = variant?.extensionUnit ?? step.step.extensionUnit;
      if (step.extensionsUsed >= allowed || value === null || unit === null) throw refuse.conflict(PROCESSING_ERROR.EXTENSION_NOT_ALLOWED);

      const calendar = await this.commands.calendarFor(tx, [step.regulatoryDueAt]);
      let due;
      try {
        due = computeDue({ anchor: { at: step.regulatoryDueAt, hasTime: true }, value, unit, rollToWorkingDay: step.step.rollToWorkingDay, calendar });
      } catch (error) {
        throw error instanceof ProcessingEngineError ? refuse.conflict(error.code) : error;
      }

      const wasOwn = step.internalDueAt !== null && step.internalDueAt.getTime() < step.regulatoryDueAt.getTime();
      const internal = wasOwn ? (step.internalDueAt as Date) : due.dueAt;
      const bands = bandInstants(earlier(due.dueAt, internal), step.step);
      await tx.procRecordStep.update({
        where: { id: step.id },
        data: {
          regulatoryDueAt: due.dueAt,
          internalDueAt: internal,
          provisional: due.provisional || step.provisional,
          ...bands,
          extensionsUsed: { increment: 1 },
          deadlineRevision: { increment: 1 },
          revision: { increment: 1 },
        },
      });
      await this.commands.change(
        tx,
        flow,
        step.stepKey,
        'STEP_EXTENDED',
        { regulatoryDueAt: iso(step.regulatoryDueAt), extensionsUsed: step.extensionsUsed },
        { regulatoryDueAt: due.dueAt.toISOString(), extensionsUsed: step.extensionsUsed + 1 },
        reason,
        actorId,
      );
    });
  }
}

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/** `YYYY-MM-DD` as the END of that civil day in Vietnam; anything else is refused. */
function parseDay(raw: unknown): Date {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(new Date(`${raw}T00:00:00.000Z`).getTime())) throw refuse.bad(PROCESSING_ERROR.DUE_DATE_INVALID);
  const day = civilDayFromIso(raw);
  if (!Number.isFinite(day)) throw refuse.bad(PROCESSING_ERROR.DUE_DATE_INVALID);
  return endOfCivilDay(day);
}

function cleanReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  return text === '' ? null : text.slice(0, MAX_REASON_LENGTH);
}
