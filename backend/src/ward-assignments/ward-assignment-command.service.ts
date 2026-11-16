import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma, WardAssignment } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { teamInScope } from '../common/utils/scope-filter.util';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { PrismaService } from '../prisma/prisma.service';
import { WARD_ASSIGNMENT_NUMBER_SERIES, WARD_AUDIT, WARD_ERROR } from './ward-assignment.codes';
import { wardBody } from './ward-errors';
import { lockedForChange, lockedForReview, lockedWardTeam } from './ward-locks';
import {
  afterWithdrawal,
  editableByUnit,
  missingForSubmission,
  nextRoundNumbers,
  normaliseSubjects,
  submittable,
  WardRuleError,
  type SubjectInput,
  type SubjectRow,
} from './ward-assignment.rules';

/** Who acts. */
export interface Actor {
  id: string;
}

/** Block 1 of a request ("Thông tin trình"), as the screen sends it. */
export interface WardAssignmentInput {
  /** The ward unit; a ward officer's own when left out. Fixed once the request exists. */
  assignedTeamId?: string | null;
  caseType: 'INCIDENT' | 'CASE';
  kind: 'NEW' | 'REASSIGN';
  previousAssignmentId?: string | null;
  reassignReason?: string | null;
  crimeId?: string | null;
  crimeOther?: string | null;
  summary: string;
  content: string;
  /** `YYYY-MM-DD`. */
  discoveredOn?: string | null;
  place?: string | null;
  subjectsUnknown: boolean;
  subjects: SubjectInput[];
  proposedInvestigatorId?: string | null;
  entryOfficerName: string;
  entryOfficerPhone?: string | null;
  unitNote?: string | null;
}

type Tx = Prisma.TransactionClient;

const blank = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** `YYYY-MM-DD` -> the calendar day (stored as a date, no time). */
function dayOf(value: string | null | undefined): Date | null {
  const v = blank(value);
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field: 'discoveredOn' }));
  const day = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== v) {
    throw new BadRequestException(wardBody(WARD_ERROR.DATE_INVALID, { field: 'discoveredOn' }));
  }
  return day;
}

/**
 * The ONLY writer of ward assignment requests (gate: `ward-assignment-writers.gate.spec.ts`). Every command locks the
 * request's row, checks that the form the person acted on is the one stored (`expectedUpdatedAt`), checks reach and
 * state, writes, and records an audit line (metadata only), in one transaction.
 *
 * Reach: a request that the person may not read does not exist for them (404); one they may read but not change is
 * refused (403). Reviewing, archiving and restoring follow the review reach, never the reach of editing.
 */
@Injectable()
export class WardAssignmentCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbers: DocumentNumbersService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: Actor, scope: DataScope | null | undefined, input: WardAssignmentInput): Promise<WardAssignment> {
    const teamId = input.assignedTeamId ?? scope?.wardTeamId ?? null;
    if (!teamId) throw new BadRequestException(wardBody(WARD_ERROR.UNIT_REQUIRED));
    return this.prisma.$transaction(async (tx) => {
      const team = await lockedWardTeam(tx, teamId);
      if (!teamInScope(team.id, scope, 'write', 'WardAssignment')) throw new ForbiddenException(wardBody(WARD_ERROR.UNIT_OUT_OF_REACH));
      const member = await tx.userTeam.findFirst({ where: { userId: actor.id, teamId: team.id }, select: { userId: true } });
      const content = await this.checkedContent(tx, team.id, input, null);
      const created = await tx.wardAssignment.create({
        data: {
          ...content.fields,
          assignedTeamId: team.id,
          enteredById: actor.id,
          enteredOnBehalf: member === null,
          subjects: { create: content.subjects },
        },
      });
      await this.audit.log(
        {
          userId: actor.id,
          action: WARD_AUDIT.CREATED,
          subject: 'WardAssignment',
          subjectId: created.id,
          metadata: { assignedTeamId: team.id, enteredOnBehalf: created.enteredOnBehalf, kind: created.kind, subjectCount: content.subjects.length },
        },
        tx,
      );
      return created;
    });
  }

  async update(
    actor: Actor,
    scope: DataScope | null | undefined,
    id: string,
    input: WardAssignmentInput & { expectedUpdatedAt: string },
  ): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForChange(tx, scope, id, input.expectedUpdatedAt);
      if (!editableByUnit(row.status)) throw new ConflictException(wardBody(WARD_ERROR.NOT_EDITABLE, { status: row.status }));
      const content = await this.checkedContent(tx, row.assignedTeamId, input, row.id);
      await tx.wardAssignmentSubject.deleteMany({ where: { assignmentId: row.id } });
      const updated = await tx.wardAssignment.update({
        where: { id: row.id },
        data: { ...content.fields, subjects: { create: content.subjects } },
      });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.UPDATED, subject: 'WardAssignment', subjectId: row.id, metadata: { status: row.status, subjectCount: content.subjects.length } },
        tx,
      );
      return updated;
    });
  }

  /** "Trình" / "Trình lại": a new round with what is submitted; the code at the first submission. */
  async submit(actor: Actor, scope: DataScope | null | undefined, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForChange(tx, scope, id, expectedUpdatedAt);
      if (!submittable(row.status)) throw new ConflictException(wardBody(WARD_ERROR.NOT_SUBMITTABLE, { status: row.status }));
      const subjects = await tx.wardAssignmentSubject.findMany({ where: { assignmentId: row.id }, orderBy: { position: 'asc' } });
      const missing = missingForSubmission({ ...row, subjectCount: subjects.length });
      if (missing.length > 0) throw new BadRequestException(wardBody(WARD_ERROR.INCOMPLETE, ...missing.map((field) => ({ field }))));
      // What the draft names may have changed since it was saved: checked again, the investigator's row locked so that
      // stopping them waits for this submission or this submission sees them stopped.
      await this.checkedReferences(tx, row.assignedTeamId, row, row.id);

      const code = row.code ?? (await this.numbers.commitWithTx(WARD_ASSIGNMENT_NUMBER_SERIES, { userId: actor.id }, tx, { documentId: row.id })).number;
      const rounds = await tx.wardAssignmentRound.findMany({ where: { assignmentId: row.id }, select: { sequence: true, submissionNo: true, status: true, submittedAt: true } });
      const { sequence, submissionNo } = nextRoundNumbers(rounds);
      const now = new Date();
      await tx.wardAssignmentRound.create({
        data: {
          assignmentId: row.id,
          sequence,
          submissionNo,
          priorStatus: row.status,
          submittedAt: now,
          submittedById: actor.id,
          snapshot: this.snapshotOf(row, subjects) as Prisma.InputJsonValue,
        },
      });
      const updated = await tx.wardAssignment.update({
        where: { id: row.id },
        data: { code, status: 'SUBMITTED', submissionCount: submissionNo, submittedAt: now },
      });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.SUBMITTED, subject: 'WardAssignment', subjectId: row.id, metadata: { code, sequence, submissionNo, priorStatus: row.status } },
        tx,
      );
      return updated;
    });
  }

  /** "Rút lại": the round waiting for PC02 is taken back; it does not count; the request goes back where it was. */
  async withdraw(actor: Actor, scope: DataScope | null | undefined, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForChange(tx, scope, id, expectedUpdatedAt);
      const rounds = await tx.wardAssignmentRound.findMany({ where: { assignmentId: row.id }, orderBy: { sequence: 'asc' } });
      const pending = rounds.at(-1);
      if (row.status !== 'SUBMITTED' || !pending || pending.status !== 'PENDING') {
        throw new ConflictException(wardBody(WARD_ERROR.NOTHING_TO_WITHDRAW, { status: row.status }));
      }
      await tx.wardAssignmentRound.update({ where: { id: pending.id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnById: actor.id } });
      const left = afterWithdrawal(rounds, pending.sequence);
      const updated = await tx.wardAssignment.update({
        where: { id: row.id },
        data: { status: pending.priorStatus, submissionCount: left.submissionCount, submittedAt: left.submittedAt },
      });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.WITHDRAWN, subject: 'WardAssignment', subjectId: row.id, metadata: { sequence: pending.sequence, backTo: pending.priorStatus } },
        tx,
      );
      return updated;
    });
  }

  /** A draft that was never submitted is deleted with its subjects. Anything ever submitted is archived instead. */
  async remove(actor: Actor, scope: DataScope | null | undefined, id: string, expectedUpdatedAt: string): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForChange(tx, scope, id, expectedUpdatedAt);
      const rounds = await tx.wardAssignmentRound.count({ where: { assignmentId: row.id } });
      if (row.status !== 'DRAFT' || rounds > 0 || row.code !== null) throw new ConflictException(wardBody(WARD_ERROR.DELETE_SUBMITTED));
      await tx.wardAssignmentSubject.deleteMany({ where: { assignmentId: row.id } });
      await tx.wardAssignment.delete({ where: { id: row.id } });
      await this.audit.log(
        { userId: actor.id, action: WARD_AUDIT.DELETED, subject: 'WardAssignment', subjectId: row.id, metadata: { assignedTeamId: row.assignedTeamId } },
        tx,
      );
      return { id: row.id };
    });
  }

  /** "Lưu trữ" (PC02): hidden from the lists, kept whole; nothing is done to it until it is restored. */
  async archive(actor: Actor, scope: DataScope | null | undefined, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForReview(tx, scope, id, expectedUpdatedAt);
      if (row.archivedAt) throw new ConflictException(wardBody(WARD_ERROR.ALREADY_ARCHIVED));
      const rounds = await tx.wardAssignmentRound.count({ where: { assignmentId: row.id } });
      if (rounds === 0) throw new ConflictException(wardBody(WARD_ERROR.ARCHIVE_DRAFT));
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { archivedAt: new Date(), archivedById: actor.id } });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.ARCHIVED, subject: 'WardAssignment', subjectId: row.id, metadata: { status: row.status } }, tx);
      return updated;
    });
  }

  /** "Khôi phục": the way back from "Lưu trữ". */
  async restore(actor: Actor, scope: DataScope | null | undefined, id: string, expectedUpdatedAt: string): Promise<WardAssignment> {
    return this.prisma.$transaction(async (tx) => {
      const row = await lockedForReview(tx, scope, id, expectedUpdatedAt);
      if (!row.archivedAt) throw new ConflictException(wardBody(WARD_ERROR.NOT_ARCHIVED));
      const updated = await tx.wardAssignment.update({ where: { id: row.id }, data: { archivedAt: null, archivedById: null } });
      await this.audit.log({ userId: actor.id, action: WARD_AUDIT.RESTORED, subject: 'WardAssignment', subjectId: row.id, metadata: { status: row.status } }, tx);
      return updated;
    });
  }

  // ── the content of block 1 ────────────────────────────────────────────────────────────────────────────────────────

  /** Block 1 checked against the database: what is stored, or a rule broken (400). */
  private async checkedContent(
    tx: Tx,
    teamId: string,
    input: WardAssignmentInput,
    selfId: string | null,
  ): Promise<{ fields: Omit<Prisma.WardAssignmentUncheckedCreateInput, 'assignedTeamId' | 'enteredById'>; subjects: SubjectRow[] }> {
    let subjects: SubjectRow[];
    try {
      subjects = normaliseSubjects(input.subjects ?? [], new Date().getFullYear());
    } catch (e) {
      if (e instanceof WardRuleError) throw new BadRequestException(wardBody(e.code, e.detail));
      throw e;
    }
    if (input.subjectsUnknown && subjects.length > 0) throw new BadRequestException(wardBody(WARD_ERROR.SUBJECTS_UNKNOWN_WITH_ROWS));

    const crimeId = blank(input.crimeId);
    const investigatorId = blank(input.proposedInvestigatorId);
    const previousId = blank(input.previousAssignmentId);
    await this.checkedReferences(tx, teamId, { crimeId, proposedInvestigatorId: investigatorId, previousAssignmentId: previousId, kind: input.kind }, selfId);
    return {
      fields: {
        caseType: input.caseType,
        kind: input.kind,
        previousAssignmentId: previousId,
        reassignReason: input.kind === 'REASSIGN' ? blank(input.reassignReason) : null,
        crimeId,
        crimeOther: blank(input.crimeOther),
        summary: (input.summary ?? '').trim(),
        content: (input.content ?? '').trim(),
        discoveredOn: dayOf(input.discoveredOn),
        place: blank(input.place),
        subjectsUnknown: input.subjectsUnknown,
        proposedInvestigatorId: investigatorId,
        entryOfficerName: (input.entryOfficerName ?? '').trim(),
        entryOfficerPhone: blank(input.entryOfficerPhone),
        unitNote: blank(input.unitNote),
      },
      subjects,
    };
  }

  /**
   * The records block 1 names, checked against the database: the crime exists; the proposed investigator is one of the
   * ward unit's own and not stopped (their row locked for share, so stopping them waits for this transaction); a
   * re-assignment names an approved request of the same ward unit.
   */
  private async checkedReferences(
    tx: Tx,
    teamId: string,
    refs: { crimeId: string | null; proposedInvestigatorId: string | null; previousAssignmentId: string | null; kind: string },
    selfId: string | null,
  ): Promise<void> {
    if (refs.crimeId && !(await tx.crime.findUnique({ where: { id: refs.crimeId }, select: { id: true } }))) {
      throw new BadRequestException(wardBody(WARD_ERROR.CRIME_UNKNOWN));
    }
    if (refs.proposedInvestigatorId) {
      const [investigator] = await tx.$queryRaw<{ teamId: string; isActive: boolean }[]>`
        SELECT "teamId", "isActive" FROM "ward_investigators" WHERE id = ${refs.proposedInvestigatorId} FOR SHARE`;
      if (!investigator || investigator.teamId !== teamId || !investigator.isActive) throw new BadRequestException(wardBody(WARD_ERROR.INVESTIGATOR_UNKNOWN));
    }
    if (refs.previousAssignmentId && refs.kind !== 'REASSIGN') throw new BadRequestException(wardBody(WARD_ERROR.PREVIOUS_ONLY_FOR_REASSIGN));
    if (refs.previousAssignmentId) {
      // A request of the same ward unit that PC02 approved: re-assignment is of an assignment that was made.
      const previous = await tx.wardAssignment.findUnique({ where: { id: refs.previousAssignmentId }, select: { assignedTeamId: true, status: true } });
      if (!previous || refs.previousAssignmentId === selfId || previous.assignedTeamId !== teamId || previous.status !== 'APPROVED') {
        throw new BadRequestException(wardBody(WARD_ERROR.PREVIOUS_UNKNOWN));
      }
    }
  }

  /** What a round keeps of the request as it was submitted (block 1 and the subjects). */
  private snapshotOf(row: WardAssignment, subjects: readonly SubjectRow[]): Record<string, unknown> {
    return {
      caseType: row.caseType,
      kind: row.kind,
      previousAssignmentId: row.previousAssignmentId,
      reassignReason: row.reassignReason,
      crimeId: row.crimeId,
      crimeOther: row.crimeOther,
      summary: row.summary,
      content: row.content,
      discoveredOn: row.discoveredOn ? row.discoveredOn.toISOString().slice(0, 10) : null,
      place: row.place,
      subjectsUnknown: row.subjectsUnknown,
      proposedInvestigatorId: row.proposedInvestigatorId,
      entryOfficerName: row.entryOfficerName,
      entryOfficerPhone: row.entryOfficerPhone,
      unitNote: row.unitNote,
      subjects: subjects.map((s) => ({ fullName: s.fullName, birthYear: s.birthYear, idNumber: s.idNumber, address: s.address })),
    };
  }
}
