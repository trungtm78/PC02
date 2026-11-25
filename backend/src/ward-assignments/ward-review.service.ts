import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import type { Prisma, WardAssignment } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_AUDIT, WARD_ERROR } from './ward-assignment.codes';
import { WardRuleError } from './ward-assignment.rules';
import type { Actor } from './ward-assignment-command.service';
import { wardBody } from './ward-errors';
import { lockedForDecision, lockedRequest } from './ward-locks';
import { deleteWardAlertRows, WardNotifier } from './ward-notifier';
import { WARD_ALERT_ERROR } from './ward-alerts.codes';
import { WardMatchingService } from './ward-matching.service';
import { decisionInForce, normaliseRequirements, resultDueFrom, returnRevocable, vnDay } from './ward-review.rules';

type Tx = Prisma.TransactionClient;
type Scope = DataScope | null | undefined;

/** The catalogue of return reasons ("Lý do trả về"): Directory rows of this type, kept by administrators. */
export const RETURN_REASON_TYPE = 'LY_DO_TRA_VE';
const RETURN_REASON_NAME_MIN = 3;
const RETURN_REASON_NAME_MAX = 150;

export interface ReturnInput {
  expectedUpdatedAt: string;
  reasonCode?: string | null;
  reasonText?: string | null;
  requirements: string[];
}
export interface ApproveInput {
  expectedUpdatedAt: string;
  assignedInvestigatorId: string;
  followUpUserId?: string | null;
  followUpTeamId?: string | null;
  requirements?: string[];
  pc02Note?: string | null;
}
export interface FollowUpInput {
  expectedUpdatedAt: string;
  receivedOn?: string | null;
  resultText?: string | null;
  pc02Note?: string | null;
}

const blank = (v: string | null | undefined): string | null => v?.trim() || null;

/** Where the stored files of documents live: the current release's uploads (linked to the shared storage). */
export const DOCUMENT_STORAGE_ROOT = path.join(process.cwd(), 'uploads', 'documents');

/**
 * The file of a document under the storage root, from its stored name, never from the recorded path (that names the
 * release which wrote it, gone after a later deploy). null for a name that is not a plain file name.
 */
export function storedFileOf(root: string, fileName: string | null | undefined): string | null {
  if (!fileName || /[\\/:]/.test(fileName) || fileName.includes('\0') || fileName === '.' || fileName === '..') return null;
  return path.join(root, fileName);
}

/** `YYYY-MM-DD` -> the calendar day (a date column, 00:00 UTC). */
function dayOf(value: string | null | undefined, field: string): Date | null {
  const v = blank(value);
  if (v === null) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(Number.NaN);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== v) throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field }));
  return day;
}

const reasonOf = (reason: string | null | undefined): string => {
  const text = blank(reason);
  if (!text) throw new BadRequestException(wardBody(WARD_ERROR.REASON_REQUIRED));
  return text;
};

function requirementsOf(lines: readonly string[] | undefined): string[] {
  try {
    return normaliseRequirements(lines ?? []);
  } catch (e) {
    if (e instanceof WardRuleError) throw new BadRequestException(wardBody(e.code, e.detail));
    throw e;
  }
}

/**
 * PC02's review of a ward unit's request and the follow-up after approval. Every command takes the request through
 * `lockedForDecision` (row lock, form stamp, review reach, not archived, never by a member of the request's own ward
 * unit) and writes the record, the round and the decision together, with an audit line (metadata only).
 *
 * A decision's `decidedAt` is the record's `updatedAt` written by the same command: "the ward unit has not touched the
 * request since the return" is then a comparison of two equal instants, not of two clocks a few ms apart.
 */
@Injectable()
export class WardReviewService {
  private readonly logger = new Logger(WardReviewService.name);

  /** The storage root the stored files are removed from (a test points it at a folder of its own). */
  storageRoot = DOCUMENT_STORAGE_ROOT;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly notifier?: WardNotifier,
    @Optional() private readonly matching?: WardMatchingService,
  ) {}

  returnReasons() {
    return this.prisma.directory.findMany({
      where: { type: RETURN_REASON_TYPE, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { code: true, name: true },
    });
  }

  /**
   * A reviewer adds a reason to the catalogue from the review itself ("Tạo mới" of the field). The same words (case
   * and spacing aside) are the same reason: the one listed is answered, never a double. A reason an administrator
   * switched off is not brought back by typing it again. Audited (the code only).
   */
  async addReturnReason(actor: Actor, input: { name?: string }): Promise<{ code: string; name: string; existed: boolean }> {
    const name = (input.name ?? '').normalize('NFC').trim().split(/[ \t]+/).join(' ');
    if (name.length < RETURN_REASON_NAME_MIN || name.length > RETURN_REASON_NAME_MAX) {
      throw new BadRequestException(wardBody(WARD_ERROR.RETURN_REASON_NAME_INVALID, { min: RETURN_REASON_NAME_MIN, max: RETURN_REASON_NAME_MAX }));
    }
    const key = name.toLocaleLowerCase('vi');
    return this.prisma.$transaction(async (tx) => {
      // One addition at a time: two reviewers typing the same reason at the same moment would both find nothing.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ward-return-reason'))::text AS locked`;
      const all = await tx.directory.findMany({ where: { type: RETURN_REASON_TYPE }, select: { code: true, name: true, isActive: true } });
      const same = all.find((r) => r.name.normalize('NFC').trim().split(/[ \t]+/).join(' ').toLocaleLowerCase('vi') === key);
      if (same) {
        if (!same.isActive) throw new ConflictException(wardBody(WARD_ERROR.RETURN_REASON_SWITCHED_OFF, { code: same.code }));
        return { code: same.code, name: same.name, existed: true };
      }
      const code = `TU_NHAP_${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
      // Before "Lý do khác" (99), after the starting set.
      await tx.directory.create({ data: { type: RETURN_REASON_TYPE, code, name, order: 50, isActive: true } });
      await this.audit.log({ userId: actor.id, action: 'WARD_RETURN_REASON_ADDED', subject: 'Directory', metadata: { type: RETURN_REASON_TYPE, code } }, tx);
      return { code, name, existed: false };
    });
  }

  /** "Trả về": the round waiting for PC02 goes back to the ward unit with its requirements. */
  async returnIt(actor: Actor, scope: Scope, id: string, input: ReturnInput): Promise<WardAssignment> {
    let ring: () => void = () => undefined;
    const returned = await this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      const round = await this.pendingRound(tx, row);
      const reasonText = blank(input.reasonText);
      const reasonCode = blank(input.reasonCode);
      if (!reasonText && !reasonCode) throw new BadRequestException(wardBody(WARD_ERROR.RETURN_REASON_REQUIRED));
      if (reasonCode && !(await tx.directory.findFirst({ where: { type: RETURN_REASON_TYPE, code: reasonCode, isActive: true }, select: { id: true } }))) {
        throw new BadRequestException(wardBody(WARD_ERROR.RETURN_REASON_UNKNOWN));
      }
      const requirements = requirementsOf(input.requirements);
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { status: 'RETURNED' } });
      await tx.wardAssignmentRound.update({ where: { id: round.id }, data: { status: 'DECIDED' } });
      const decision = await tx.wardAssignmentDecision.create({
        data: { roundId: round.id, kind: 'RETURN', decidedAt: updated.updatedAt, decidedById: actor.id, reasonCode, reasonText, requirements },
      });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.RETURNED, subject: 'WardAssignment', subjectId: row.id, metadata: { decisionId: decision.id, round: round.sequence, reasonCode, requirements: requirements.length } },
        tx,
      );
      // The ward unit is told with the decision (rolled back with it), the bells ring after the commit.
      if (this.notifier) ring = await this.notifier.recordEvent(tx, { kind: 'RETURNED', assignmentId: row.id, decisionId: decision.id });
      return updated;
    });
    ring();
    return returned;
  }

  /** "Thu hồi trả về": only while the ward unit has done nothing with the request since. */
  async revokeReturn(actor: Actor, scope: Scope, id: string, input: { expectedUpdatedAt: string; reason: string }): Promise<WardAssignment> {
    const reason = reasonOf(input.reason);
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      const { round, decision } = await this.lastDecision(tx, row.id);
      if (!round || !returnRevocable(row, decision)) throw new ConflictException(wardBody(WARD_ERROR.RETURN_NOT_REVOCABLE));
      await tx.wardAssignmentDecision.update({ where: { id: decision!.id }, data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: reason } });
      await tx.wardAssignmentRound.update({ where: { id: round.id }, data: { status: 'PENDING' } });
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { status: 'SUBMITTED' } });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.RETURN_REVOKED, subject: 'WardAssignment', subjectId: row.id, metadata: { decisionId: decision!.id } }, tx);
      return updated;
    });
  }

  /** "Duyệt và phân công": the investigator who acts, the PC02 person and unit who follow; the deadline starts. */
  async approve(actor: Actor, scope: Scope, id: string, input: ApproveInput, now: Date = new Date()): Promise<WardAssignment> {
    // The subjects are screened before an approval, as a petition's duplicates are before it is saved: a person with
    // the same identity number in another record must be concluded on ("the same" / "not the same") first. Read before
    // the transaction (the matching reads several modules); what was reviewed goes into the approval's audit line.
    let reviewed: Omit<Awaited<ReturnType<WardMatchingService['screenForApproval']>>, 'open'> | null = null;
    const screen = async () => {
      if (!this.matching) return;
      const { open, ...rest } = await this.matching.screenForApproval(scope, actor.id, id);
      if (open.length > 0) {
        throw new ConflictException(
          wardBody(WARD_ALERT_ERROR.MATCH_REVIEW_REQUIRED, ...open.map((m) => ({ subjectPosition: m.subjectPosition, source: m.source, recordId: m.recordId }))),
        );
      }
      reviewed = rest;
    };
    await screen();
    let ring: () => void = () => undefined;
    const approved = await this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      // Screened again once the request is locked: a person given the same number elsewhere in the meantime is not
      // approved past. (Other modules' rows are not locked: the window left is this transaction's own few milliseconds.)
      await screen();
      const round = await this.pendingRound(tx, row);
      const [investigator] = await tx.$queryRaw<{ teamId: string; isActive: boolean }[]>`
        SELECT "teamId", "isActive" FROM "ward_investigators" WHERE id = ${input.assignedInvestigatorId} FOR SHARE`;
      if (!investigator || investigator.teamId !== row.assignedTeamId || !investigator.isActive) throw new BadRequestException(wardBody(WARD_ERROR.INVESTIGATOR_UNKNOWN));
      const followUpUserId = blank(input.followUpUserId) ?? actor.id;
      const followUpTeamId = await this.followUpTeam(tx, followUpUserId, blank(input.followUpTeamId));
      const requirements = requirementsOf(input.requirements);
      const receivedOn = vnDay(now);
      const updated = await tx.wardAssignment.update({
        where: { id: row.id },
        data: {
          status: 'APPROVED',
          assignedInvestigatorId: input.assignedInvestigatorId,
          followUpUserId,
          followUpTeamId,
          receivedOn,
          resultDueOn: resultDueFrom(receivedOn),
          ...(input.pc02Note !== undefined && { pc02Note: blank(input.pc02Note) }),
        },
      });
      await tx.wardAssignmentRound.update({ where: { id: round.id }, data: { status: 'DECIDED' } });
      const decision = await tx.wardAssignmentDecision.create({
        data: {
          roundId: round.id, kind: 'APPROVE', decidedAt: updated.updatedAt, decidedById: actor.id, requirements,
          assignedInvestigatorId: input.assignedInvestigatorId, followUpUserId, followUpTeamId,
        },
      });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.APPROVED, subject: 'WardAssignment', subjectId: row.id, metadata: { decisionId: decision.id, round: round.sequence, followUpTeamId, requirements: requirements.length, ...(reviewed && { matchesReviewed: reviewed }) } },
        tx,
      );
      if (this.notifier) ring = await this.notifier.recordEvent(tx, { kind: 'APPROVED', assignmentId: row.id, decisionId: decision.id });
      return updated;
    });
    ring();
    return approved;
  }

  /** "Huỷ duyệt": back to waiting for PC02, refused once a result is recorded (the result would lose its approval). */
  async cancelApproval(actor: Actor, scope: Scope, id: string, input: { expectedUpdatedAt: string; reason: string }): Promise<WardAssignment> {
    const reason = reasonOf(input.reason);
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_ERROR.NOT_APPROVED));
      const files = await tx.document.count({ where: { wardAssignmentId: row.id, deletedAt: null, wardSlipOf: null } });
      if (blank(row.resultText) || row.completedOn || files > 0) throw new ConflictException(wardBody(WARD_ERROR.APPROVAL_HAS_RESULT));
      const { round, decision } = await this.lastDecision(tx, row.id);
      if (!round || decision?.kind !== 'APPROVE') throw new ConflictException(wardBody(WARD_ERROR.NOT_APPROVED));
      await tx.wardAssignmentDecision.update({ where: { id: decision.id }, data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: reason } });
      await tx.wardAssignmentRound.update({ where: { id: round.id }, data: { status: 'PENDING' } });
      const updated = await tx.wardAssignment.update({
        where: { id: row.id },
        data: { status: 'SUBMITTED', assignedInvestigatorId: null, followUpUserId: null, followUpTeamId: null, receivedOn: null, resultDueOn: null },
      });
      await this.audit.log(
        {
          userId: actor.id, action: WARD_AUDIT.APPROVAL_CANCELLED, subject: 'WardAssignment', subjectId: row.id,
          metadata: { decisionId: decision.id, receivedOn: row.receivedOn?.toISOString().slice(0, 10) ?? null, resultDueOn: row.resultDueOn?.toISOString().slice(0, 10) ?? null },
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Block 3 after approval: when the unit received the file back (the deadline follows it while it was never extended),
   * the result, PC02's note.
   */
  async followUp(actor: Actor, scope: Scope, id: string, input: FollowUpInput): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_ERROR.NOT_APPROVED));
      // A completed request is changed only after "Mở lại" (with its reason): its result and timeliness stand as completed.
      if (row.completedOn) throw new ConflictException(wardBody(WARD_ERROR.ALREADY_COMPLETED));
      const data: Prisma.WardAssignmentUpdateInput = {};
      if (input.receivedOn !== undefined) {
        const receivedOn = dayOf(input.receivedOn, 'receivedOn');
        if (!receivedOn) throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field: 'receivedOn' }));
        data.receivedOn = receivedOn;
        const extended = await this.extendedSinceApproval(tx, row.id);
        if (!extended) data.resultDueOn = resultDueFrom(receivedOn);
      }
      if (input.resultText !== undefined) data.resultText = blank(input.resultText);
      if (input.pc02Note !== undefined) data.pc02Note = blank(input.pc02Note);
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.FOLLOW_UP_UPDATED, subject: 'WardAssignment', subjectId: row.id, metadata: { fields: Object.keys(data) } }, tx);
      return updated;
    });
  }

  /** "Gia hạn": a later deadline, with its reason, kept in the history of the request. */
  async extend(actor: Actor, scope: Scope, id: string, input: { expectedUpdatedAt: string; newDueOn: string; reason: string }): Promise<WardAssignment> {
    const reason = reasonOf(input.reason);
    const newDueOn = dayOf(input.newDueOn, 'newDueOn');
    if (!newDueOn) throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field: 'newDueOn' }));
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_ERROR.NOT_APPROVED));
      if (row.completedOn) throw new ConflictException(wardBody(WARD_ERROR.ALREADY_COMPLETED));
      if (row.resultDueOn && newDueOn.getTime() <= row.resultDueOn.getTime()) throw new BadRequestException(wardBody(WARD_ERROR.EXTEND_NOT_LATER));
      await tx.wardAssignmentDeadlineChange.create({ data: { assignmentId: row.id, oldDueOn: row.resultDueOn, newDueOn, reason, changedById: actor.id } });
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { resultDueOn: newDueOn } });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.DEADLINE_EXTENDED, subject: 'WardAssignment', subjectId: row.id, metadata: { oldDueOn: row.resultDueOn?.toISOString().slice(0, 10) ?? null, newDueOn: input.newDueOn } },
        tx,
      );
      return updated;
    });
  }

  /** "Hoàn thành": the day the result was completed (not in the future), once a result is written. */
  async complete(actor: Actor, scope: Scope, id: string, input: { expectedUpdatedAt: string; completedOn: string }, now: Date = new Date()): Promise<WardAssignment> {
    const completedOn = dayOf(input.completedOn, 'completedOn');
    if (!completedOn) throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field: 'completedOn' }));
    if (completedOn.getTime() > vnDay(now).getTime()) throw new BadRequestException(wardBody(WARD_ERROR.COMPLETED_IN_FUTURE));
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      if (row.status !== 'APPROVED') throw new ConflictException(wardBody(WARD_ERROR.NOT_APPROVED));
      if (row.completedOn) throw new ConflictException(wardBody(WARD_ERROR.ALREADY_COMPLETED));
      if (!blank(row.resultText)) throw new BadRequestException(wardBody(WARD_ERROR.RESULT_REQUIRED));
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { completedOn } });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.COMPLETED, subject: 'WardAssignment', subjectId: row.id, metadata: { completedOn: input.completedOn } }, tx);
      return updated;
    });
  }

  /** "Mở lại": the way back from "Hoàn thành". */
  async reopen(actor: Actor, scope: Scope, id: string, input: { expectedUpdatedAt: string; reason: string }): Promise<WardAssignment> {
    const reason = reasonOf(input.reason);
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForDecision(tx, scope, actor.id, id, input.expectedUpdatedAt);
      if (!row.completedOn) throw new ConflictException(wardBody(WARD_ERROR.NOT_COMPLETED));
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { completedOn: null } });
      const reopening = await tx.wardAssignmentReopening.create({ data: { assignmentId: row.id, completedOn: row.completedOn, reason, reopenedById: actor.id, reopenedAt: updated.updatedAt } });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.REOPENED, subject: 'WardAssignment', subjectId: row.id, metadata: { reopeningId: reopening.id, completedOn: row.completedOn.toISOString().slice(0, 10) } },
        tx,
      );
      return updated;
    });
  }

  // ── deleting a request with its data (administrators) ─────────────────────────────────────────────────────────────

  /** What "delete with data" would remove, for the confirmation screen. Administrators only. */
  async deletionImpact(scope: Scope, id: string) {
    if (scope !== null) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
    const row = await this.prisma.wardAssignment.findUnique({ where: { id }, select: { id: true, code: true } });
    if (!row) throw new NotFoundException(wardBody(WARD_ERROR.NOT_FOUND));
    return { id: row.id, code: row.code, ...(await this.counts(this.prisma, id)) };
  }

  /**
   * "Xoá kèm dữ liệu": the request and everything it holds, children first, in one transaction; the confirmation must
   * repeat its code (its id for a request that never had one). The stored files are removed from disk after the
   * commit; any that cannot be are named in the answer, never ignored.
   */
  async deleteWithData(actor: Actor, scope: Scope, id: string, input: { confirmCode: string; expectedUpdatedAt: string }) {
    if (scope !== null) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
    const { counts, files } = await this.prisma.$transaction(async (tx) => {
      const row = await lockedRequest(tx, scope, id, input.expectedUpdatedAt);
      if ((input.confirmCode ?? '').trim() !== (row.code ?? row.id)) throw new BadRequestException(wardBody(WARD_ERROR.DELETE_CONFIRM_MISMATCH));
      const counted = await this.counts(tx, row.id);
      const docs = await tx.document.findMany({ where: { wardAssignmentId: row.id }, select: { id: true, fileName: true } });
      const roundIds = (await tx.wardAssignmentRound.findMany({ where: { assignmentId: row.id }, select: { id: true } })).map((r) => r.id);
      // Children first: every relation is RESTRICT. Decisions name their slip documents, so decisions go before documents.
      // What was removed, not what was counted a moment before (a match about this request may be recorded meanwhile).
      const alerts = await deleteWardAlertRows(tx, row.id);
      Object.assign(counted, { matchConclusions: alerts.conclusions, reminders: alerts.reminders });
      await tx.wardAssignmentDecision.deleteMany({ where: { roundId: { in: roundIds } } });
      await tx.wardAssignmentRound.deleteMany({ where: { assignmentId: row.id } });
      await tx.wardAssignmentDeadlineChange.deleteMany({ where: { assignmentId: row.id } });
      await tx.wardAssignmentReopening.deleteMany({ where: { assignmentId: row.id } });
      await tx.wardAssignmentSubject.deleteMany({ where: { assignmentId: row.id } });
      await tx.documentRenderLog.deleteMany({ where: { wardAssignmentId: row.id } });
      await tx.document.deleteMany({ where: { wardAssignmentId: row.id } });
      await tx.wardAssignment.updateMany({ where: { previousAssignmentId: row.id }, data: { previousAssignmentId: null } });
      await tx.wardAssignment.delete({ where: { id: row.id } });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.DELETED_WITH_DATA, subject: 'WardAssignment', subjectId: row.id, metadata: { code: row.code, assignedTeamId: row.assignedTeamId, ...counted } },
        tx,
      );
      return { counts: counted, files: docs };
    });
    const notRemoved: string[] = [];
    for (const doc of files) {
      const file = storedFileOf(this.storageRoot, doc.fileName);
      if (!file) {
        this.logger.error(`file of deleted ward request not removed: document ${doc.id} has no plain stored name`);
        notRemoved.push(doc.id);
        continue;
      }
      try {
        await fs.unlink(file);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
        this.logger.error(`file of deleted ward request not removed: document ${doc.id}`, (e as Error).stack);
        notRemoved.push(doc.id);
      }
    }
    return { id, ...counts, filesNotRemoved: notRemoved };
  }

  // ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The round waiting for PC02, or 409: the request is not waiting for a decision. */
  private async pendingRound(tx: Tx, row: WardAssignment) {
    const last = await tx.wardAssignmentRound.findFirst({ where: { assignmentId: row.id }, orderBy: { sequence: 'desc' } });
    if (row.status !== 'SUBMITTED' || !last || last.status !== 'PENDING') throw new ConflictException(wardBody(WARD_ERROR.NOT_REVIEWABLE, { status: row.status }));
    return last;
  }

  /** The last round that is not withdrawn, and its decision in force. */
  private async lastDecision(tx: Tx, assignmentId: string) {
    const round = await tx.wardAssignmentRound.findFirst({
      where: { assignmentId, status: { not: 'WITHDRAWN' } },
      orderBy: { sequence: 'desc' },
      include: { decisions: true },
    });
    return { round, decision: round ? decisionInForce(round.decisions) : null };
  }

  /** The PC02 unit that follows: the one given (a unit that is not a ward unit, active, the follower a member of it), or the follower's only such unit. */
  private async followUpTeam(tx: Tx, userId: string, teamId: string | null): Promise<string> {
    const units = await tx.userTeam.findMany({ where: { userId, team: { wardId: null, status: 'ACTIVE' } }, select: { teamId: true } });
    if (teamId) {
      if (!units.some((u) => u.teamId === teamId)) throw new BadRequestException(wardBody(WARD_ERROR.FOLLOW_UP_TEAM_INVALID));
      return teamId;
    }
    if (units.length !== 1) throw new BadRequestException(wardBody(WARD_ERROR.FOLLOW_UP_TEAM_REQUIRED, { choices: units.length }));
    return units[0].teamId;
  }

  /** Whether the deadline was extended since the approval in force (then a new "received" day does not move it). */
  private async extendedSinceApproval(tx: Tx, assignmentId: string): Promise<boolean> {
    const { decision } = await this.lastDecision(tx, assignmentId);
    if (!decision) return false;
    return (await tx.wardAssignmentDeadlineChange.count({ where: { assignmentId, changedAt: { gte: decision.decidedAt } } })) > 0;
  }

  private async counts(db: Tx | PrismaService, id: string) {
    const [subjects, rounds, decisions, deadlineChanges, reopenings, files, matchConclusions, reminders] = await Promise.all([
      db.wardAssignmentSubject.count({ where: { assignmentId: id } }),
      db.wardAssignmentRound.count({ where: { assignmentId: id } }),
      db.wardAssignmentDecision.count({ where: { round: { assignmentId: id } } }),
      db.wardAssignmentDeadlineChange.count({ where: { assignmentId: id } }),
      db.wardAssignmentReopening.count({ where: { assignmentId: id } }),
      db.document.count({ where: { wardAssignmentId: id } }),
      db.wardSubjectMatchConclusion.count({ where: { OR: [{ assignmentId: id }, { otherSource: 'WARD_ASSIGNMENT', otherRecordId: id }] } }),
      db.wardAssignmentReminder.count({ where: { assignmentId: id } }),
    ]);
    return { subjects, rounds, decisions, deadlineChanges, reopenings, files, matchConclusions, reminders };
  }
}
