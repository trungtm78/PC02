import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { setEnforcement } from '../authz/enforcement';
import type { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { NOTHING, type PreciseScope } from '../common/utils/precise-scope';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { WardAssignmentQueryService } from './ward-assignment-query.service';
import { ALERT_LEVELS } from './ward-alerts';
import { CaseNotificationPolicyService } from '../notifications/case-notification-policy.service';
import { WardMatchingService } from './ward-matching.service';
import { WardNotifier } from './ward-notifier';
import { WardStatsService } from './ward-stats.service';

/**
 * Lane D on a real PostgreSQL: subject matching, the deadline alert of the list, the notices and reminders, the
 * statistics. Scopes shaped as permissions by team gives them; the enforcement registry answers for the people of
 * this suite only.
 *
 * Expected values come from the plan (A5, C3, C4, R4, P1, C8, section 7) and hand counts of the fixture, not from
 * running the code.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const ALL: PreciseScope = { ...NOTHING, all: true };
const teams = (...teamIds: string[]): PreciseScope => ({ ...NOTHING, tree: { teamIds, userIds: [], includeUnassigned: false } });
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface Shape {
  ward: { read: PreciseScope; write?: PreciseScope; review?: PreciseScope; match?: PreciseScope };
  petition?: PreciseScope;
  case?: PreciseScope;
  wardTeamId?: string | null;
}

run('ward assignment requests, lane D: matching, alerts, notices, statistics (PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let scratch: ScratchDatabase;
  let db: PrismaClient;
  const tag = `wad-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const scope: Record<string, DataScope> = {};
  const keys: Record<string, string[]> = {};
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  const shaped = (userId: string, s: Shape): DataScope => ({
    teamIds: [],
    userIds: [userId],
    writableTeamIds: [],
    writableUserIds: [userId],
    isWardOfficer: !!s.wardTeamId,
    wardTeamId: s.wardTeamId ?? null,
    precise: {
      userId,
      subjects: {
        Case: { read: s.case ?? NOTHING, write: NOTHING },
        Incident: { read: NOTHING, write: NOTHING },
        Petition: { read: s.petition ?? NOTHING, write: NOTHING },
        WardAssignment: { read: s.ward.read, write: s.ward.write ?? NOTHING, actions: { review: s.ward.review ?? NOTHING, matchSubjects: s.ward.match ?? NOTHING } },
      },
    },
  });

  /** The scope of a person of the suite, by user id (`scope` is keyed by the fixture's names). */
  const scopeOfUser = (userId: string): DataScope | undefined => scope[Object.keys(id).find((k) => id[k] === userId) ?? ''];

  /** The case rule as the governance core gives it for these scopes (the core's own suite proves the core). */
  const caseAccess = {
    entity: jest.fn(async (_s: string, _a: string, actorId: string) => {
      if (!keys[actorId]?.includes('read:Case')) throw new ForbiddenException('no');
    }),
    listWhere: jest.fn(async (actorId: string) => {
      if (!keys[actorId]?.includes('read:Case')) throw new ForbiddenException('no');
      return buildScopeFilter(scopeOfUser(actorId), 'read', 'Case') ?? {};
    }),
  } as unknown as CaseChildAccessService;

  const request = async (key: string, teamId: string, subjects: { fullName: string; fullNameNorm: string; birthYear?: number; idNumberNorm?: string }[], extra: Record<string, unknown> = {}) => {
    const row = await db.wardAssignment.create({
      data: {
        code: `${tag}-${key}`,
        status: 'SUBMITTED',
        assignedTeamId: teamId,
        enteredById: id.wardy,
        caseType: 'CASE',
        summary: `${tag} ${key}`,
        content: 'nội dung',
        entryOfficerName: 'Cán bộ nhập',
        submissionCount: 1,
        ...extra,
        subjects: { create: subjects.map((s, i) => ({ position: i + 1, fullName: s.fullName, fullNameNorm: s.fullNameNorm, birthYear: s.birthYear ?? null, idNumberNorm: s.idNumberNorm ?? null })) },
      },
    });
    id[key] = row.id;
    return row;
  };

  const round = (assignmentId: string, n: { sequence: number; submissionNo?: number; status: 'PENDING' | 'DECIDED' | 'WITHDRAWN'; priorStatus?: 'DRAFT' | 'RETURNED'; submittedAt: string }) =>
    db.wardAssignmentRound.create({
      data: {
        assignmentId,
        sequence: n.sequence,
        submissionNo: n.submissionNo ?? n.sequence,
        status: n.status,
        priorStatus: n.priorStatus ?? 'DRAFT',
        submittedAt: new Date(n.submittedAt),
        submittedById: id.wardy,
        snapshot: {},
      },
    });
  const decide = (roundId: string, kind: 'RETURN' | 'APPROVE', decidedAt: string, by = id.reviewerMatch) =>
    db.wardAssignmentDecision.create({ data: { roundId, kind, decidedAt: new Date(decidedAt), decidedById: by, requirements: [] } });

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    db = scratch.db;
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    for (const name of ['wardy', 'otherWard', 'reviewerNoMatch', 'reviewerMatch', 'followUp', 'statsReader']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    }
    const ward = async (key: string) => (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: `${tag} ${key}` } })).id;
    for (const key of ['W', 'V', 'S1', 'S2', 'N']) id[key] = (await db.team.create({ data: { code: `${tag}-${key}`, name: `${tag} CAP ${key}`, wardId: await ward(key.toLowerCase()) } })).id;
    for (const key of ['P', 'T1', 'T2']) id[key] = (await db.team.create({ data: { code: `${tag}-${key}`, name: `${tag} Đội ${key}` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.wardy, teamId: id.W },
        { userId: id.otherWard, teamId: id.V },
        { userId: id.reviewerNoMatch, teamId: id.P },
        { userId: id.reviewerMatch, teamId: id.P },
        { userId: id.followUp, teamId: id.P },
      ],
    });
    scope.wardy = shaped(id.wardy, { ward: { read: teams(id.W, id.N), write: teams(id.W, id.N) }, petition: teams(id.T1), wardTeamId: id.W });
    scope.otherWard = shaped(id.otherWard, { ward: { read: teams(id.V), write: teams(id.V) }, wardTeamId: id.V });
    scope.reviewerNoMatch = shaped(id.reviewerNoMatch, { ward: { read: ALL, review: ALL }, petition: ALL, case: ALL });
    scope.reviewerMatch = shaped(id.reviewerMatch, { ward: { read: ALL, review: ALL, match: ALL }, petition: teams(id.T1), case: teams(id.T1) });
    scope.followUp = shaped(id.followUp, { ward: { read: ALL } });
    scope.statsReader = shaped(id.statsReader, { ward: { read: teams(id.S1, id.S2) } });
    keys[id.wardy] = ['read:WardAssignment', 'edit:WardAssignment', 'read:Petition'];
    keys[id.otherWard] = ['read:WardAssignment', 'edit:WardAssignment'];
    // Holds read:Petition and read:Case, but has no matchSubjects reach: sees neither.
    keys[id.reviewerNoMatch] = ['read:WardAssignment', 'review:WardAssignment', 'read:Petition', 'read:Case'];
    keys[id.reviewerMatch] = ['read:WardAssignment', 'review:WardAssignment', 'matchSubjects:WardAssignment', 'read:Petition', 'read:Case'];
    keys[id.followUp] = ['read:WardAssignment'];
    keys[id.statsReader] = ['read:WardAssignment'];
    setEnforcement({
      scopeOf: (u) => scopeOfUser(u),
      keysOf: (u) => keys[u],
      unconditionalKeysOf: (u) => keys[u],
      keysOrNone: (u) => keys[u],
      holdersOf: (p) => Object.keys(keys).filter((u) => keys[u].includes(p)),
    });
  });

  afterAll(async () => {
    setEnforcement(null);
    const mine = await db.wardAssignment.findMany({ where: { assignedTeam: { code: { startsWith: tag } } }, select: { id: true } });
    const ids = mine.map((m) => m.id);
    const users = Object.entries(id).filter(([k]) => ['wardy', 'otherWard', 'reviewerNoMatch', 'reviewerMatch', 'followUp', 'statsReader'].includes(k)).map(([, v]) => v);
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.wardAssignmentReminder.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardSubjectMatchConclusion.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentDecision.deleteMany({ where: { round: { assignmentId: { in: ids } } } });
    await db.wardAssignmentRound.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentSubject.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignment.deleteMany({ where: { id: { in: ids } } });
    await db.subject.deleteMany({ where: { fullName: { startsWith: 'Nguyễn Văn Tèo' }, case: { name: { startsWith: tag } } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await scratch.close();
  });

  describe('subject matching: never shown nor counted outside the person\'s reach', () => {
    let matching: WardMatchingService;
    const TEO = { fullName: 'Nguyễn Văn Tèo', fullNameNorm: 'nguyen van teo', birthYear: 1990, idNumberNorm: '079090000111' };

    beforeAll(async () => {
      matching = new WardMatchingService(db as unknown as PrismaService, audit, caseAccess);
      await request('A', id.W, [TEO, { fullName: 'Lê Thị Hoa', fullNameNorm: 'le thi hoa', birthYear: 1985 }]);
      await request('B', id.W, [{ fullName: 'Nguyen Van Teo', fullNameNorm: 'nguyen van teo', birthYear: 1990 }]);
      await request('C', id.V, [{ fullName: 'Ng. V. Tèo', fullNameNorm: 'ng. v. teo', birthYear: 1991, idNumberNorm: '079090000111' }]);
      await request('D', id.V, [{ fullName: 'Lê Thị Hoa', fullNameNorm: 'le thi hoa', birthYear: 1985 }]);
      // Same name, another birth year: not a match at all.
      await request('E', id.W, [{ fullName: 'Nguyễn Văn Tèo', fullNameNorm: 'nguyen van teo', birthYear: 1970 }]);
      const petition = async (key: string, teamId: string, suspect: string) =>
        (id[key] = (
          await db.petition.create({
            data: { stt: `${tag}-${key}`, receivedDate: day('2026-11-01'), senderName: 'Người gửi', suspectedPerson: suspect, suspectedPersonBd: ` ${suspect.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()}`, enteredById: id.wardy, assignedTeamId: teamId } as never,
          })
        ).id);
      await petition('P1', id.T1, 'Nguyễn Văn Tèo và đồng bọn');
      await petition('P2', id.T2, 'Nguyễn Văn Tèo');
      // Part of a longer name: not the same words.
      await petition('P3', id.T1, 'Nguyễn Văn Tèong');
      const kase = async (key: string, teamId: string, idNumber: string, dob: string) => {
        const made = await db.case.create({ data: { name: `${tag}-${key}`, caseProvenance: 'DIRECT_DISCOVERY', assignedTeamId: teamId } as never });
        id[key] = made.id;
        await db.subject.create({ data: { caseId: made.id, fullName: 'Nguyễn Văn Tèo', idNumber, dateOfBirth: new Date(dob) } });
      };
      await kase('K1', id.T1, '079-090-000-111', '1990-03-01T00:00:00Z');
      await kase('K2', id.T2, '079090000111', '1990-03-01T00:00:00Z');
      // Born 1 January 1990 in Viet Nam (17:00 UTC the day before): a 1990 birth, not a 1989 one; matched by name + year.
      await kase('K3', id.T1, '', '1989-12-31T17:00:00Z');
    });

    const seen = (list: { source: string; recordId: string; level: string; subjectPosition: number }[]) =>
      list.map((m) => `${m.subjectPosition}:${m.source}:${Object.keys(id).find((k) => id[k] === m.recordId)}:${m.level}`).sort();

    it('a ward officer: matches in their own unit\'s requests only (no other ward, no petition even one they may read)', async () => {
      expect(seen(await matching.matches(scope.wardy, id.wardy, id.A))).toEqual(['1:WARD_ASSIGNMENT:B:POSSIBLE']);
    });

    it('a reviewer without matchSubjects: the same, although they read every request, petition and case', async () => {
      expect(seen(await matching.matches(scope.reviewerNoMatch, id.reviewerNoMatch, id.A))).toEqual(['1:WARD_ASSIGNMENT:B:POSSIBLE']);
    });

    it('a reviewer with matchSubjects: every unit, and petitions and cases within their own read reach only', async () => {
      expect(seen(await matching.matches(scope.reviewerMatch, id.reviewerMatch, id.A))).toEqual([
        '1:CASE:K1:CERTAIN',
        '1:CASE:K3:POSSIBLE',
        '1:PETITION:P1:POSSIBLE',
        '1:WARD_ASSIGNMENT:B:POSSIBLE',
        '1:WARD_ASSIGNMENT:C:CERTAIN',
        '2:WARD_ASSIGNMENT:D:POSSIBLE',
      ]);
      // P2 and K2 (outside the petition / case reach) are not there, and nothing says they exist.
    });

    it('a request of another unit does not exist for a ward officer (404), matches included', async () => {
      await expect(matching.matches(scope.otherWard, id.otherWard, id.A)).rejects.toMatchObject({ status: 404 });
    });

    it('"not the same person" hides the pair afterwards; "the same" keeps it, marked; nobody concludes what they cannot see', async () => {
      await matching.conclude(scope.reviewerMatch, id.reviewerMatch, id.A, { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: id.C, samePerson: false });
      expect(seen(await matching.matches(scope.reviewerMatch, id.reviewerMatch, id.A))).not.toContain('1:WARD_ASSIGNMENT:C:CERTAIN');
      // Turned back.
      await matching.conclude(scope.reviewerMatch, id.reviewerMatch, id.A, { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: id.C, samePerson: true });
      const back = (await matching.matches(scope.reviewerMatch, id.reviewerMatch, id.A)).find((m) => m.recordId === id.C);
      expect(back).toMatchObject({ level: 'CERTAIN', concludedSame: true });
      expect(await db.wardSubjectMatchConclusion.count({ where: { assignmentId: id.A } })).toBe(1);
      // Outside the person's petition reach: as if it did not exist.
      await expect(
        matching.conclude(scope.reviewerMatch, id.reviewerMatch, id.A, { subjectPosition: 1, otherSource: 'PETITION', otherRecordId: id.P2, samePerson: false }),
      ).rejects.toMatchObject({ status: 404 });
      // A conclusion is about the people as they were: A's subjects rewritten (every edit does) = asked again.
      await matching.conclude(scope.reviewerMatch, id.reviewerMatch, id.A, { subjectPosition: 2, otherSource: 'WARD_ASSIGNMENT', otherRecordId: id.D, samePerson: false });
      expect(seen(await matching.matches(scope.reviewerMatch, id.reviewerMatch, id.A))).not.toContain('2:WARD_ASSIGNMENT:D:POSSIBLE');
      const old = await db.wardAssignmentSubject.findFirstOrThrow({ where: { assignmentId: id.A, position: 2 } });
      await db.wardAssignmentSubject.delete({ where: { id: old.id } });
      await db.wardAssignmentSubject.create({
        data: { assignmentId: id.A, position: 2, fullName: old.fullName, fullNameNorm: old.fullNameNorm, birthYear: old.birthYear, createdAt: new Date(Date.now() + 1000) },
      });
      expect(seen(await matching.matches(scope.reviewerMatch, id.reviewerMatch, id.A))).toContain('2:WARD_ASSIGNMENT:D:POSSIBLE');
      // A ward officer has no review reach.
      await expect(
        matching.conclude(scope.wardy, id.wardy, id.A, { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: id.B, samePerson: false }),
      ).rejects.toMatchObject({ status: 403 });
    });

    /** Runs `meanwhile` in the gap between the check of the pair and the write of the conclusion (the race Codex named). */
    const inTheGap = (meanwhile: () => Promise<unknown>) => {
      const service = matching as unknown as { matchesIgnoringConclusions: (...a: unknown[]) => Promise<unknown> };
      const real = service.matchesIgnoringConclusions.bind(matching);
      const spy = jest.spyOn(service, 'matchesIgnoringConclusions').mockImplementationOnce(async (...a: unknown[]) => {
        const found = await real(...a);
        await meanwhile();
        return found;
      });
      return spy;
    };

    it('the subjects rewritten between the check and the write: 409, nothing recorded about the person replaced', async () => {
      const row = await request('gapEdit', id.W, [{ fullName: 'Nguyễn Văn Gap', fullNameNorm: 'nguyen van gap', birthYear: 1990, idNumberNorm: `${tag}GAP1` }]);
      await request('gapOther', id.W, [{ fullName: 'Nguyễn Văn Gap', fullNameNorm: 'nguyen van gap', birthYear: 1990, idNumberNorm: `${tag}GAP1` }]);
      const other = await db.wardAssignment.findFirstOrThrow({ where: { code: `${tag}-gapOther` } });
      const spy = inTheGap(async () => {
        const old = await db.wardAssignmentSubject.findFirstOrThrow({ where: { assignmentId: row.id, position: 1 } });
        await db.wardAssignmentSubject.delete({ where: { id: old.id } });
        await db.wardAssignmentSubject.create({ data: { assignmentId: row.id, position: 1, fullName: 'Người khác', fullNameNorm: 'nguoi khac', createdAt: new Date(Date.now() + 1000) } });
      });
      await expect(
        matching.conclude(scope.reviewerMatch, id.reviewerMatch, row.id, { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: other.id, samePerson: false }),
      ).rejects.toMatchObject({ status: 409 });
      spy.mockRestore();
      expect(await db.wardSubjectMatchConclusion.count({ where: { assignmentId: row.id } })).toBe(0);
    });

    it('the request deleted between the check and the write: no conclusion is left behind it', async () => {
      const row = await request('gapDel', id.W, [{ fullName: 'Trần Văn Gap', fullNameNorm: 'tran van gap', birthYear: 1991, idNumberNorm: `${tag}GAP2` }]);
      await request('gapDelOther', id.W, [{ fullName: 'Trần Văn Gap', fullNameNorm: 'tran van gap', birthYear: 1991, idNumberNorm: `${tag}GAP2` }]);
      const other = await db.wardAssignment.findFirstOrThrow({ where: { code: `${tag}-gapDelOther` } });
      const spy = inTheGap(async () => {
        await db.wardAssignmentSubject.deleteMany({ where: { assignmentId: row.id } });
        await db.wardAssignment.delete({ where: { id: row.id } });
      });
      await expect(
        matching.conclude(scope.reviewerMatch, id.reviewerMatch, row.id, { subjectPosition: 1, otherSource: 'WARD_ASSIGNMENT', otherRecordId: other.id, samePerson: true }),
      ).rejects.toMatchObject({ status: 404 });
      spy.mockRestore();
      expect(await db.wardSubjectMatchConclusion.count({ where: { assignmentId: row.id } })).toBe(0);
    });
  });

  describe('the deadline alert of the list: the filter count is the rows, each row carries the level filtered on', () => {
    // 20/11/2026 23:30 in Viet Nam: "today" is the 20th.
    const now = new Date('2026-11-20T16:30:00.000Z');
    let queries: WardAssignmentQueryService;

    beforeAll(async () => {
      queries = new WardAssignmentQueryService(db as unknown as PrismaService);
      const approved = (key: string, due: string | null, completed: string | null = null) =>
        request(key, id.N, [], { status: 'APPROVED', resultDueOn: due ? day(due) : null, completedOn: completed ? day(completed) : null });
      await approved('due8', '2026-11-28');
      await approved('due7', '2026-11-27');
      await approved('due4', '2026-11-24');
      await approved('due3', '2026-11-23');
      await approved('due0', '2026-11-20');
      await approved('dueMinus1', '2026-11-19');
      await approved('doneLate', '2026-11-01', '2026-11-10');
      await approved('noDue', null);
      await request('pendingN', id.N, []);
    });

    const expected: Record<string, string[]> = {
      NONE: ['due8', 'noDue', 'pendingN'],
      YELLOW: ['due4', 'due7'],
      RED: ['due0', 'due3'],
      OVERDUE: ['dueMinus1'],
      DONE: ['doneLate'],
    };

    it.each(ALERT_LEVELS.map((l) => [l]))('%s', async (level) => {
      const { data, total } = await queries.list(scope.wardy, { teamId: id.N, alert: level, pageSize: 200 }, now);
      expect(total).toBe(data.length);
      expect(data.map((r) => Object.keys(id).find((k) => id[k] === r.id)).sort()).toEqual(expected[level]);
      for (const row of data) expect(row.alert.level).toBe(level);
    });

    it('the levels partition the rows: their counts add up to the unfiltered total', async () => {
      const all = await queries.list(scope.wardy, { teamId: id.N, pageSize: 200 }, now);
      let sum = 0;
      for (const level of ALERT_LEVELS) sum += (await queries.list(scope.wardy, { teamId: id.N, alert: level }, now)).total;
      expect(sum).toBe(all.total);
      expect(all.data.find((r) => r.id === id.dueMinus1)?.alert).toEqual({ level: 'OVERDUE', dueOn: '2026-11-19', daysLeft: -1 });
    });

    it('at VN midnight the day turns: the request due on the 20th becomes overdue at 17:00 UTC', async () => {
      const before = await queries.list(scope.wardy, { teamId: id.N, alert: 'OVERDUE' }, new Date('2026-11-20T16:59:59.999Z'));
      const after = await queries.list(scope.wardy, { teamId: id.N, alert: 'OVERDUE' }, new Date('2026-11-20T17:00:00.000Z'));
      expect(before.data.map((r) => r.id)).not.toContain(id.due0);
      expect(after.data.map((r) => r.id)).toContain(id.due0);
    });
  });

  describe('notices and reminders', () => {
    let notifier: WardNotifier;
    const noticesOf = (userId: string, assignmentId: string) =>
      db.notification.findMany({ where: { userId, metadata: { path: ['wardAssignmentId'], equals: assignmentId } }, orderBy: { createdAt: 'asc' } });

    beforeAll(() => {
      notifier = new WardNotifier(db as unknown as PrismaService);
    });

    it('a new submission: the reviewers whose review reach covers it, never the ward unit; told once however often asked', async () => {
      const row = await request('nS', id.W, []);
      const r1 = await round(row.id, { sequence: 1, status: 'PENDING', submittedAt: '2026-11-16T01:00:00Z' });
      for (let i = 0; i < 2; i++) await db.$transaction(async (tx) => (await notifier.recordEvent(tx, { kind: 'SUBMITTED', assignmentId: row.id, roundId: r1.id }))());
      expect(await noticesOf(id.reviewerMatch, row.id)).toHaveLength(1);
      expect(await noticesOf(id.reviewerNoMatch, row.id)).toHaveLength(1);
      expect(await noticesOf(id.wardy, row.id)).toHaveLength(0);
      expect(await noticesOf(id.followUp, row.id)).toHaveLength(0);
      const [notice] = await noticesOf(id.reviewerMatch, row.id);
      expect(notice).toMatchObject({ type: 'WARD_ASSIGNMENT_SUBMITTED', link: `/ho-so-phan-cong/${row.id}`, pushNextRetryAt: null });
      // The bell shows it only while the person may still open the request: moved off the ward, it is gone (and not counted).
      const policy = new CaseNotificationPolicyService(db as unknown as PrismaService);
      expect(await policy.serialize(id.reviewerMatch, notice)).not.toBeNull();
      const kept = scope.reviewerMatch;
      scope.reviewerMatch = shaped(id.reviewerMatch, { ward: { read: teams(id.V) } });
      try {
        expect(await policy.serialize(id.reviewerMatch, notice)).toBeNull();
        expect(await db.notification.count({ where: { AND: [await policy.where(id.reviewerMatch), { id: notice.id }] } })).toBe(0);
      } finally {
        scope.reviewerMatch = kept;
      }
    });

    it('returned: the ward unit; re-submitted: only the reviewer who returned it', async () => {
      const row = await request('nR', id.W, [], { status: 'RETURNED' });
      const r1 = await round(row.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-11-16T01:00:00Z' });
      const ret = await decide(r1.id, 'RETURN', '2026-11-16T03:00:00Z', id.reviewerNoMatch);
      await db.$transaction(async (tx) => (await notifier.recordEvent(tx, { kind: 'RETURNED', assignmentId: row.id, decisionId: ret.id }))());
      expect((await noticesOf(id.wardy, row.id)).map((n) => n.type)).toEqual(['WARD_ASSIGNMENT_RETURNED']);
      expect(await noticesOf(id.otherWard, row.id)).toHaveLength(0);
      const r2 = await round(row.id, { sequence: 2, status: 'PENDING', priorStatus: 'RETURNED', submittedAt: '2026-11-17T01:00:00Z' });
      await db.$transaction(async (tx) => (await notifier.recordEvent(tx, { kind: 'SUBMITTED', assignmentId: row.id, roundId: r2.id }))());
      expect((await noticesOf(id.reviewerNoMatch, row.id)).map((n) => n.type)).toEqual(['WARD_ASSIGNMENT_RESUBMITTED']);
      expect(await noticesOf(id.reviewerMatch, row.id)).toHaveLength(0);
    });

    it('the deadline: YELLOW once, RED once, OVERDUE once a day, nothing after completion', async () => {
      const row = await request('nD', id.W, [], { status: 'APPROVED', resultDueOn: day('2026-12-10'), followUpUserId: id.followUp });
      const r1 = await round(row.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-10-01T01:00:00Z' });
      await decide(r1.id, 'APPROVE', '2026-10-02T01:00:00Z');
      const at = (vnDate: string) => new Date(`${vnDate}T00:05:00.000Z`); // 07:05 in Viet Nam
      const types = async () => (await noticesOf(id.followUp, row.id)).map((n) => n.type);

      await notifier.remindDeadlines(at('2026-12-02')); // 8 days left
      expect(await types()).toEqual([]);
      await notifier.remindDeadlines(at('2026-12-03')); // 7: yellow
      await notifier.remindDeadlines(at('2026-12-04')); // 6: still yellow, nothing new
      expect(await types()).toEqual(['WARD_ASSIGNMENT_DEADLINE_NEAR']);
      await notifier.remindDeadlines(at('2026-12-07')); // 3: red
      await notifier.remindDeadlines(at('2026-12-07'));
      expect(await types()).toHaveLength(2);
      await notifier.remindDeadlines(at('2026-12-11')); // overdue 1
      await notifier.remindDeadlines(at('2026-12-11'));
      await notifier.remindDeadlines(at('2026-12-12')); // overdue 2
      expect(await types()).toEqual(['WARD_ASSIGNMENT_DEADLINE_NEAR', 'WARD_ASSIGNMENT_DEADLINE_NEAR', 'WARD_ASSIGNMENT_OVERDUE', 'WARD_ASSIGNMENT_OVERDUE']);
      // The person who entered it is told the same.
      expect(await noticesOf(id.wardy, row.id)).toHaveLength(4);
      await db.wardAssignment.update({ where: { id: row.id }, data: { completedOn: day('2026-12-12') } });
      await notifier.remindDeadlines(at('2026-12-13'));
      expect(await types()).toHaveLength(4);
      expect(await db.wardAssignmentReminder.count({ where: { assignmentId: row.id } })).toBe(4);
    });

    it('a crash between the mark and the notices loses nothing: neither is kept, the next run tells', async () => {
      const row = await request('nC', id.W, [], { status: 'APPROVED', resultDueOn: day('2026-12-20'), followUpUserId: id.followUp });
      const r1 = await round(row.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-10-01T01:00:00Z' });
      await decide(r1.id, 'APPROVE', '2026-10-02T01:00:00Z');
      const crashing = new Proxy(db, {
        get(target, prop) {
          if (prop !== '$transaction') return Reflect.get(target, prop);
          return (fn: (tx: unknown) => Promise<unknown>) =>
            target.$transaction((tx) =>
              fn(
                new Proxy(tx, {
                  get(inner, p) {
                    if (p === 'notification') return { createMany: () => Promise.reject(new Error('the process died here')) };
                    return Reflect.get(inner, p);
                  },
                }),
              ),
            );
        },
      });
      const when = new Date('2026-12-18T00:05:00.000Z');
      const failed = await new WardNotifier(crashing as unknown as PrismaService).remindDeadlines(when);
      expect(failed.failed).toBeGreaterThanOrEqual(1);
      expect(await db.wardAssignmentReminder.count({ where: { assignmentId: row.id } })).toBe(0);
      expect(await noticesOf(id.followUp, row.id)).toHaveLength(0);
      await notifier.remindDeadlines(when);
      expect((await noticesOf(id.followUp, row.id)).map((n) => n.type)).toEqual(['WARD_ASSIGNMENT_DEADLINE_NEAR']);
      expect(await db.wardAssignmentReminder.count({ where: { assignmentId: row.id } })).toBe(1);
    });
  });

  describe('statistics equal a hand count of the fixture', () => {
    let stats: WardStatsService;
    const now = new Date('2026-11-20T03:00:00.000Z');

    beforeAll(async () => {
      stats = new WardStatsService(db as unknown as PrismaService);
      const s1a = await request('s1a', id.S1, [], { kind: 'NEW', status: 'APPROVED', submissionCount: 1, resultDueOn: day('2026-12-03'), completedOn: day('2026-11-10') });
      await decide((await round(s1a.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-10-01T02:00:00Z' })).id, 'APPROVE', '2026-10-03T02:00:00Z');
      const s1b = await request('s1b', id.S1, [], { kind: 'REASSIGN', status: 'APPROVED', submissionCount: 2, resultDueOn: day('2026-11-15') });
      await decide((await round(s1b.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-10-05T02:00:00Z' })).id, 'RETURN', '2026-10-06T02:00:00Z');
      await decide((await round(s1b.id, { sequence: 2, status: 'DECIDED', priorStatus: 'RETURNED', submittedAt: '2026-10-10T02:00:00Z' })).id, 'APPROVE', '2026-10-14T02:00:00Z');
      const s1c = await request('s1c', id.S1, [], { kind: 'NEW', status: 'SUBMITTED', submissionCount: 1 });
      await round(s1c.id, { sequence: 1, status: 'PENDING', submittedAt: '2026-11-02T02:00:00Z' });
      const s2a = await request('s2a', id.S2, [], { kind: 'NEW', status: 'RETURNED', submissionCount: 1 });
      await decide((await round(s2a.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-11-03T02:00:00Z' })).id, 'RETURN', '2026-11-05T02:00:00Z');
      // First submitted 20/09 18:00 UTC = 21/09 in Viet Nam.
      const s2b = await request('s2b', id.S2, [], { kind: 'NEW', status: 'APPROVED', submissionCount: 1, resultDueOn: day('2026-11-01'), completedOn: day('2026-11-05') });
      await decide((await round(s2b.id, { sequence: 1, status: 'DECIDED', submittedAt: '2026-09-20T18:00:00Z' })).id, 'APPROVE', '2026-09-22T18:00:00Z');
      // Not counted: a draft never submitted, an archived request.
      await request('s2draft', id.S2, [], { status: 'DRAFT', submissionCount: 0, code: null });
      const arch = await request('s2arch', id.S2, [], { archivedAt: new Date('2026-11-01T00:00:00Z') });
      await round(arch.id, { sequence: 1, status: 'PENDING', submittedAt: '2026-11-01T00:00:00Z' });
    });

    it('cards, months, units and crimes', async () => {
      const result = await stats.stats(scope.statsReader, {}, now);
      expect(result.cards).toEqual({ total: 5, new: 4, reassign: 1, pending: 1, returned: 1, overdue: 1, onTimeRate: 50, avgSubmissions: 1.2, firstPassRate: 66.7, avgReviewDays: 2.2 });
      expect(result.byMonth).toEqual([
        { month: '2026-09', new: 1, reassign: 0 },
        { month: '2026-10', new: 1, reassign: 1 },
        { month: '2026-11', new: 2, reassign: 0 },
      ]);
      expect(result.byUnit).toEqual([
        { teamId: id.S1, name: `${tag} CAP S1`, total: 3, new: 2, reassign: 1, pending: 1, returned: 0, overdue: 1, onTimeRate: 100, avgSubmissions: 1.33, firstPassRate: 50, avgReviewDays: 2.3 },
        { teamId: id.S2, name: `${tag} CAP S2`, total: 2, new: 2, reassign: 0, pending: 0, returned: 1, overdue: 0, onTimeRate: 0, avgSubmissions: 1, firstPassRate: 100, avgReviewDays: 2 },
      ]);
      expect(result.byCrime).toEqual([{ crimeId: null, name: null, total: 5, new: 4, reassign: 1 }]);
    });

    it('the period is the first submission on the Viet Nam calendar', async () => {
      expect((await stats.stats(scope.statsReader, { from: '2026-10-01', to: '2026-10-31' }, now)).cards.total).toBe(2);
      expect((await stats.stats(scope.statsReader, { from: '2026-09-21', to: '2026-09-21' }, now)).cards.total).toBe(1);
      expect((await stats.stats(scope.statsReader, { to: '2026-09-20' }, now)).cards.total).toBe(0);
      await expect(stats.stats(scope.statsReader, { from: '2026-10-31', to: '2026-10-01' }, now)).rejects.toMatchObject({ status: 400 });
    });

    it('within the read scope only, and a card is the count of the list with the same filter', async () => {
      const onlyS1 = shaped(id.statsReader, { ward: { read: teams(id.S1) } });
      expect((await stats.stats(onlyS1, {}, now)).cards.total).toBe(3);
      const queries = new WardAssignmentQueryService(db as unknown as PrismaService);
      const overdueList = await queries.list(scope.statsReader, { alert: 'OVERDUE' }, now);
      expect(overdueList.total).toBe((await stats.stats(scope.statsReader, {}, now)).cards.overdue);
      const pendingList = await queries.list(scope.statsReader, { status: 'SUBMITTED', teamId: id.S1 }, now);
      expect(pendingList.total).toBe((await stats.stats(scope.statsReader, { teamId: id.S1 }, now)).cards.pending);
      // The total of a period opens the same rows: submitted at least once, first submitted within the period.
      for (const period of [{}, { from: '2026-10-01', to: '2026-10-31' }, { from: '2026-09-21', to: '2026-09-21' }, { from: '2026-10-06' }, { to: '2026-10-05' }]) {
        const listed = await queries.list(scope.statsReader, { submitted: true, ...period, pageSize: 200 }, now);
        expect({ period, rows: listed.total }).toEqual({ period, rows: (await stats.stats(scope.statsReader, period, now)).cards.total });
      }
      // s1b was first submitted on 05/10 (its second round on 10/10): not a request "first submitted from 06/10".
      expect((await queries.list(scope.statsReader, { submitted: true, from: '2026-10-06' }, now)).data.map((r) => r.id)).not.toContain(id.s1b);
      await expect(queries.list(scope.statsReader, { from: '2026-02-31' }, now)).rejects.toMatchObject({ status: 400 });
    });
  });
});
