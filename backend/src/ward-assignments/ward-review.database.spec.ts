import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { NOTHING, type PreciseScope } from '../common/utils/precise-scope';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { WARD_AUDIT, WARD_ERROR } from './ward-assignment.codes';
import { WardAssignmentCommandService, type WardAssignmentInput } from './ward-assignment-command.service';
import { WardReviewService } from './ward-review.service';

/**
 * PC02's review of a ward unit's request, on a real PostgreSQL, with the real services and audit.
 *
 * Expected values from the owner's decisions of 16/11/2026, not from the code: PC02 returns with requirements or
 * approves and assigns (the investigator who acts, the PC02 person and unit who follow); the deadline for the result is
 * received + 2 months; every decision has its way back (a return taken back while the unit has not touched it, an
 * approval cancelled while no result is recorded, a completion reopened); somebody of the request's own ward unit
 * never decides it; only an administrator deletes a request with its data, repeating its code.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const ALL: PreciseScope = { ...NOTHING, all: true };
const tree = (teamIds: string[]): PreciseScope => ({ ...NOTHING, tree: { teamIds, userIds: [], includeUnassigned: false } });

run('ward assignment requests: PC02 review, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  let commands: WardAssignmentCommandService;
  let review: WardReviewService;
  const tag = `war-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const scope: Record<string, DataScope | null> = {};

  const enforced = (userId: string, ward: { read: PreciseScope; write: PreciseScope; review?: PreciseScope }, wardTeamId: string | null): DataScope => ({
    teamIds: [], userIds: [userId], writableTeamIds: [], writableUserIds: [userId], isWardOfficer: wardTeamId !== null, wardTeamId,
    precise: {
      userId,
      subjects: {
        Case: { read: NOTHING, write: NOTHING }, Incident: { read: NOTHING, write: NOTHING }, Petition: { read: NOTHING, write: NOTHING },
        WardAssignment: { read: ward.read, write: ward.write, actions: { review: ward.review ?? NOTHING, matchSubjects: NOTHING } },
      },
    },
  });
  const input = (over: Partial<WardAssignmentInput> = {}): WardAssignmentInput => ({
    caseType: 'CASE', kind: 'NEW', crimeId: id.crime, summary: `${tag} Nhóm đánh bạc`, content: 'Nội dung', subjectsUnknown: true, subjects: [],
    proposedInvestigatorId: id.invW, entryOfficerName: 'Phạm Thị D', ...over,
  });
  const fails = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return 'resolved';
    } catch (e) {
      const err = e as { getStatus?: () => number; getResponse?: () => unknown; message?: string };
      return { status: err.getStatus?.(), body: err.getResponse?.() ?? err.message };
    }
  };
  /** A request of ward W, submitted, as PC02 finds it. */
  const submitted = async () => {
    const made = await commands.create({ id: id.wardy }, scope.wardy, input());
    return commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
  };
  const stamp = (row: { updatedAt: Date }) => row.updatedAt.toISOString();
  const approved = async (now?: Date) => {
    const sent = await submitted();
    return review.approve({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), assignedInvestigatorId: id.invW }, now);
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    const { db } = scratch;
    const role = await db.role.create({ data: { name: `${tag}-r` } });
    for (const name of ['wardy', 'reviewer', 'twoUnits', 'lonely', 'other']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    }
    const ward = async (key: string) => (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: key } })).id;
    id.W = (await db.team.create({ data: { code: `${tag}-W`, name: `${tag} W`, wardId: await ward('w') } })).id;
    id.V = (await db.team.create({ data: { code: `${tag}-V`, name: `${tag} V`, wardId: await ward('v') } })).id;
    id.P = (await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Đội 1 PC02` } })).id;
    id.P2 = (await db.team.create({ data: { code: `${tag}-P2`, name: `${tag} Đội 2 PC02` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.wardy, teamId: id.W },
        { userId: id.reviewer, teamId: id.P },
        { userId: id.twoUnits, teamId: id.W },
        { userId: id.twoUnits, teamId: id.P },
        { userId: id.other, teamId: id.P },
        { userId: id.other, teamId: id.P2 },
      ],
    });
    id.crime = (await db.crime.create({ data: { code: `${tag}-D322`, name: 'Tội đánh bạc', articleNo: 322, chapter: 'XXI' } })).id;
    id.invW = (await db.wardInvestigator.create({ data: { teamId: id.W, fullName: `${tag} Lê Văn C`, createdById: id.wardy } })).id;
    id.invV = (await db.wardInvestigator.create({ data: { teamId: id.V, fullName: `${tag} Hồ Văn E`, createdById: id.wardy } })).id;
    await db.directory.create({ data: { type: 'LY_DO_TRA_VE', code: `${tag}-THIEU`, name: 'Thiếu tài liệu' } });

    scope.wardy = enforced(id.wardy, { read: tree([id.W]), write: tree([id.W]) }, id.W);
    scope.reviewer = enforced(id.reviewer, { read: ALL, write: NOTHING, review: ALL }, null);
    scope.twoUnits = enforced(id.twoUnits, { read: ALL, write: tree([id.W]), review: ALL }, id.W);
    scope.lonely = enforced(id.lonely, { read: ALL, write: NOTHING, review: ALL }, null);
    scope.other = enforced(id.other, { read: ALL, write: NOTHING, review: ALL }, null);

    const documentType = `WARD_SPEC_${tag}`;
    id.template = (
      await db.documentNumberTemplate.create({
        data: { name: `${tag} codes`, documentType, createdById: id.wardy, separator: '-', segments: [{ type: 'LITERAL', value: tag }, { type: 'COUNTER' }], counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 1 } },
      })
    ).id;
    const numbers = new DocumentNumbersService(db as never);
    const ownNumbers = {
      commitWithTx: (_t: string, c: { userId: string }, tx: Prisma.TransactionClient, o?: object) => numbers.commitWithTx(documentType, c, tx, o),
    };
    const audit = new AuditService(db as never);
    commands = new WardAssignmentCommandService(db as never, ownNumbers as never, audit);
    review = new WardReviewService(db as never, audit);
  });

  afterAll(async () => {
    const { db } = scratch;
    const ids = (await db.wardAssignment.findMany({ where: { assignedTeam: { code: { startsWith: tag } } }, select: { id: true } })).map((m) => m.id);
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: Object.values(id) } }, { subjectId: { in: ids } }] } });
    await db.wardAssignmentDecision.deleteMany({ where: { round: { assignmentId: { in: ids } } } });
    await db.wardAssignmentRound.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentDeadlineChange.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentSubject.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignment.deleteMany({ where: { id: { in: ids } } });
    await db.wardInvestigator.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.documentNumberLog.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberCounter.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberTemplate.deleteMany({ where: { id: id.template } });
    await db.crime.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  describe('returning', () => {
    it('goes back to the ward unit with its reason and numbered requirements; the round is decided', async () => {
      const sent = await submitted();
      const back = await review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, {
        expectedUpdatedAt: stamp(sent), reasonCode: `${tag}-THIEU`, reasonText: 'Thiếu biên bản', requirements: ['Ghi lời khai bổ sung', 'Trích xuất camera'],
      });
      expect(back.status).toBe('RETURNED');
      const round = await scratch.db.wardAssignmentRound.findFirstOrThrow({ where: { assignmentId: sent.id }, include: { decisions: true } });
      expect(round.status).toBe('DECIDED');
      expect(round.decisions).toEqual([expect.objectContaining({ kind: 'RETURN', decidedById: id.reviewer, reasonCode: `${tag}-THIEU`, requirements: ['Ghi lời khai bổ sung', 'Trích xuất camera'] })]);
      expect(round.decisions[0].decidedAt.getTime()).toBe(back.updatedAt.getTime());
      expect((await scratch.db.auditLog.findMany({ where: { subjectId: sent.id } })).map((a) => a.action)).toContain(WARD_AUDIT.RETURNED);
      // The ward unit corrects and submits again: the second submission.
      const again = await commands.submit({ id: id.wardy }, scope.wardy, sent.id, stamp(back));
      expect(again).toMatchObject({ status: 'SUBMITTED', submissionCount: 2 });
    });

    it('needs a reason from the catalogue or in words; a blank requirement is refused with its number', async () => {
      const sent = await submitted();
      expect(await fails(review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), requirements: [] }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.RETURN_REASON_REQUIRED } });
      expect(await fails(review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), reasonCode: 'NO-SUCH', requirements: [] }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.RETURN_REASON_UNKNOWN } });
      expect(await fails(review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), reasonText: 'x', requirements: ['Một', ' '] }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.REQUIREMENT_EMPTY, details: [{ position: 2 }] } });
    });

    it('a draft or an approved request is not waiting for a decision', async () => {
      const draft = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(await fails(review.returnIt({ id: id.reviewer }, scope.reviewer, draft.id, { expectedUpdatedAt: stamp(draft), reasonText: 'x', requirements: [] }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOT_REVIEWABLE } });
    });

    it('taken back while the ward unit has not touched it; once the unit corrected it, it cannot be', async () => {
      const sent = await submitted();
      const back = await review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), reasonText: 'Thiếu', requirements: [] });
      expect(await fails(review.revokeReturn({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(back), reason: ' ' }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.REASON_REQUIRED } });
      const revoked = await review.revokeReturn({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(back), reason: 'Trả nhầm' });
      expect(revoked).toMatchObject({ status: 'SUBMITTED', submissionCount: 1 });
      const decision = await scratch.db.wardAssignmentDecision.findFirstOrThrow({ where: { round: { assignmentId: sent.id } } });
      expect(decision).toMatchObject({ revokedById: id.reviewer, revokeReason: 'Trả nhầm' });
      expect((await scratch.db.wardAssignmentRound.findFirstOrThrow({ where: { assignmentId: sent.id } })).status).toBe('PENDING');

      const back2 = await review.returnIt({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(revoked), reasonText: 'Thiếu lần nữa', requirements: [] });
      const edited = await commands.update({ id: id.wardy }, scope.wardy, sent.id, { ...input({ summary: `${tag} đã sửa` }), expectedUpdatedAt: stamp(back2) });
      expect(await fails(review.revokeReturn({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(edited), reason: 'x' }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.RETURN_NOT_REVOCABLE } });
    });
  });

  describe('who decides', () => {
    it('somebody of the request\'s own ward unit never decides it, even holding the review; a ward officer has no review at all', async () => {
      const sent = await submitted();
      expect(await fails(review.returnIt({ id: id.twoUnits }, scope.twoUnits, sent.id, { expectedUpdatedAt: stamp(sent), reasonText: 'x', requirements: [] }))).toMatchObject({ status: 403, body: { code: WARD_ERROR.REVIEW_OWN_UNIT_FORBIDDEN } });
      expect(await fails(review.approve({ id: id.twoUnits }, scope.twoUnits, sent.id, { expectedUpdatedAt: stamp(sent), assignedInvestigatorId: id.invW }))).toMatchObject({ status: 403, body: { code: WARD_ERROR.REVIEW_OWN_UNIT_FORBIDDEN } });
      expect(await fails(review.approve({ id: id.wardy }, scope.wardy, sent.id, { expectedUpdatedAt: stamp(sent), assignedInvestigatorId: id.invW }))).toMatchObject({ status: 403, body: { code: WARD_ERROR.FORBIDDEN } });
    });
  });

  describe('approving and assigning', () => {
    it('names the investigator; the reviewer and their PC02 unit follow; received today, due two months later', async () => {
      const sent = await submitted();
      const done = await review.approve({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: stamp(sent), assignedInvestigatorId: id.invW, requirements: ['Báo kết quả trước hạn'] }, new Date('2026-12-31T05:00:00Z'));
      expect(done).toMatchObject({ status: 'APPROVED', assignedInvestigatorId: id.invW, followUpUserId: id.reviewer, followUpTeamId: id.P });
      expect(done.receivedOn?.toISOString().slice(0, 10)).toBe('2026-12-31');
      expect(done.resultDueOn?.toISOString().slice(0, 10)).toBe('2027-02-28');
      const decision = await scratch.db.wardAssignmentDecision.findFirstOrThrow({ where: { round: { assignmentId: sent.id } } });
      expect(decision).toMatchObject({ kind: 'APPROVE', assignedInvestigatorId: id.invW, followUpTeamId: id.P, requirements: ['Báo kết quả trước hạn'] });
    });

    it('the investigator is one of the ward unit\'s own; the follow-up unit is a PC02 unit of the follower, chosen when there are several', async () => {
      const sent = await submitted();
      const s = stamp(sent);
      expect(await fails(review.approve({ id: id.reviewer }, scope.reviewer, sent.id, { expectedUpdatedAt: s, assignedInvestigatorId: id.invV }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.INVESTIGATOR_UNKNOWN } });
      expect(await fails(review.approve({ id: id.lonely }, scope.lonely, sent.id, { expectedUpdatedAt: s, assignedInvestigatorId: id.invW }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.FOLLOW_UP_TEAM_REQUIRED } });
      expect(await fails(review.approve({ id: id.other }, scope.other, sent.id, { expectedUpdatedAt: s, assignedInvestigatorId: id.invW }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.FOLLOW_UP_TEAM_REQUIRED, details: [{ choices: 2 }] } });
      expect(await fails(review.approve({ id: id.other }, scope.other, sent.id, { expectedUpdatedAt: s, assignedInvestigatorId: id.invW, followUpTeamId: id.W }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.FOLLOW_UP_TEAM_INVALID } });
      expect(await review.approve({ id: id.other }, scope.other, sent.id, { expectedUpdatedAt: s, assignedInvestigatorId: id.invW, followUpTeamId: id.P2 })).toMatchObject({ followUpTeamId: id.P2 });
    });

    it('an approval is cancelled while no result is recorded; with a result it is not', async () => {
      const done = await approved();
      const cancelled = await review.cancelApproval({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(done), reason: 'Duyệt nhầm' });
      expect(cancelled).toMatchObject({ status: 'SUBMITTED', assignedInvestigatorId: null, followUpTeamId: null, receivedOn: null, resultDueOn: null });
      expect((await scratch.db.wardAssignmentRound.findFirstOrThrow({ where: { assignmentId: done.id } })).status).toBe('PENDING');
      const again = await review.approve({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(cancelled), assignedInvestigatorId: id.invW });
      const withResult = await review.followUp({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(again), resultText: 'Đã khởi tố' });
      expect(await fails(review.cancelApproval({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(withResult), reason: 'x' }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.APPROVAL_HAS_RESULT } });
    });
  });

  describe('after approval: received, deadline, result, completion', () => {
    it('a new received day moves the deadline until it is extended; an extension is later, with a reason, and kept', async () => {
      const done = await approved(new Date('2026-11-16T03:00:00Z'));
      const moved = await review.followUp({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(done), receivedOn: '2026-11-20' });
      expect(moved.resultDueOn?.toISOString().slice(0, 10)).toBe('2027-01-20');
      expect(await fails(review.extend({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(moved), newDueOn: '2027-01-20', reason: 'x' }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.EXTEND_NOT_LATER } });
      const extended = await review.extend({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(moved), newDueOn: '2027-02-20', reason: 'Chờ giám định' });
      expect(extended.resultDueOn?.toISOString().slice(0, 10)).toBe('2027-02-20');
      expect(await scratch.db.wardAssignmentDeadlineChange.findMany({ where: { assignmentId: done.id } })).toEqual([
        expect.objectContaining({ reason: 'Chờ giám định', changedById: id.reviewer }),
      ]);
      const after = await review.followUp({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(extended), receivedOn: '2026-11-25' });
      expect(after.resultDueOn?.toISOString().slice(0, 10)).toBe('2027-02-20');
    });

    it('completed once a result is written, not in the future; reopened with a reason; nothing extends a completed request', async () => {
      const done = await approved(new Date('2026-11-16T03:00:00Z'));
      const now = new Date('2026-11-20T03:00:00Z');
      expect(await fails(review.complete({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(done), completedOn: '2026-11-19' }, now))).toMatchObject({ status: 400, body: { code: WARD_ERROR.RESULT_REQUIRED } });
      const written = await review.followUp({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(done), resultText: 'Đã khởi tố vụ án' });
      expect(await fails(review.complete({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(written), completedOn: '2026-11-21' }, now))).toMatchObject({ status: 400, body: { code: WARD_ERROR.COMPLETED_IN_FUTURE } });
      const completed = await review.complete({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(written), completedOn: '2026-11-19' }, now);
      expect(completed.completedOn?.toISOString().slice(0, 10)).toBe('2026-11-19');
      expect(await fails(review.extend({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(completed), newDueOn: '2027-12-31', reason: 'x' }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.ALREADY_COMPLETED } });
      const reopened = await review.reopen({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(completed), reason: 'Bổ sung kết quả' });
      expect(reopened.completedOn).toBeNull();
      expect(await fails(review.reopen({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(reopened), reason: 'x' }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOT_COMPLETED } });
    });
  });

  describe('deleting a request with its data', () => {
    it('administrators only, repeating the code; every row of the request goes, children first', async () => {
      const done = await approved();
      await review.extend({ id: id.reviewer }, scope.reviewer, done.id, { expectedUpdatedAt: stamp(done), newDueOn: '2030-01-01', reason: 'x' });
      const current = await scratch.db.wardAssignment.findUniqueOrThrow({ where: { id: done.id } });
      expect(await fails(review.deletionImpact(scope.reviewer, done.id))).toMatchObject({ status: 403 });
      expect(await review.deletionImpact(null, done.id)).toMatchObject({ code: current.code, rounds: 1, decisions: 1, deadlineChanges: 1, files: 0, subjects: 0 });
      expect(await fails(review.deleteWithData({ id: id.reviewer }, scope.reviewer, done.id, { confirmCode: current.code!, expectedUpdatedAt: stamp(current) }))).toMatchObject({ status: 403 });
      expect(await fails(review.deleteWithData({ id: id.reviewer }, null, done.id, { confirmCode: 'wrong', expectedUpdatedAt: stamp(current) }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.DELETE_CONFIRM_MISMATCH } });
      const gone = await review.deleteWithData({ id: id.reviewer }, null, done.id, { confirmCode: current.code!, expectedUpdatedAt: stamp(current) });
      expect(gone).toMatchObject({ rounds: 1, decisions: 1, deadlineChanges: 1, filesNotRemoved: [] });
      expect(await scratch.db.wardAssignment.findUnique({ where: { id: done.id } })).toBeNull();
      expect(await scratch.db.wardAssignmentRound.count({ where: { assignmentId: done.id } })).toBe(0);
      expect((await scratch.db.auditLog.findFirstOrThrow({ where: { subjectId: done.id, action: WARD_AUDIT.DELETED_WITH_DATA } })).metadata).toMatchObject({ rounds: 1, decisions: 1 });
    });
  });

  it('the catalogue of return reasons lists the active ones', async () => {
    expect((await review.returnReasons()).map((r) => r.code)).toContain(`${tag}-THIEU`);
  });
});
