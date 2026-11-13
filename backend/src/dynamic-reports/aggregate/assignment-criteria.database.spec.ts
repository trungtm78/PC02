import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { AggregateService } from './aggregate.service';

/**
 * Changing the criteria a team reports while its period is running (D09), on a REAL PostgreSQL: what is written,
 * what is refused, and that nothing changes without a line of history.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('AggregateService.setAssignmentCriteria on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: AggregateService;
  const tag = `ac-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let managerId = '';
  let roleId = '';
  let teamId = '';

  async function scenario(opts: { status?: 'OPEN' | 'FINALIZED'; state?: string } = {}) {
    n += 1;
    const report = await db.dynReport.create({ data: { code: `${tag}-${n}`, name: `${tag}`, status: 'PUBLISHED' } });
    await db.dynReportRole.create({ data: { reportId: report.id, userId: managerId, role: 'MANAGER' } });
    const version = await db.dynReportVersion.create({
      data: {
        reportId: report.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64),
        fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't',
        fields: {
          create: [
            { sheetKey: 'S', address: 'C2', fieldKey: 'S!C2', label: 'a', type: 'NUM', itemKey: 'alpha' },
            { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'b', type: 'NUM', itemKey: 'beta' },
          ],
        },
      },
    });
    const period = await db.dynReportPeriod.create({
      data: {
        reportId: report.id, versionId: version.id, periodKey: '2026-10', startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'), opensAt: new Date('2026-10-01'), dueAt: new Date('2027-01-01'),
        scheduleSnapshot: {}, status: opts.status ?? 'OPEN',
      },
    });
    const assignment = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId, teamSnapshot: { name: 'Tổ' } } });
    await db.dynReportSubmission.create({
      data: { assignmentId: assignment.id, state: (opts.state ?? 'DRAFT') as never, currentRevision: 1, values: { 'S!C3': { t: 'NUM', v: '9' } } },
    });
    await db.dynReportSnapshot.create({
      data: { periodId: period.id, mode: 'SUBMITTED', sourceHash: 'h', sourceRevisions: {}, contributorSetHash: 'c', values: {}, engineVersion: 't', asOf: new Date() },
    });
    return { periodId: period.id, assignmentId: assignment.id };
  }
  const set = (s: { periodId: string; assignmentId: string }, itemKeys: string[] | null, reason = 'Đổi phân công', who = managerId) =>
    svc.setAssignmentCriteria(s.periodId, who, roleId, s.assignmentId, itemKeys, reason);

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new AggregateService(db as never, {} as never, { emit: jest.fn() } as never, {} as never, {} as never);
    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    managerId = (await db.user.create({ data: { username: `${tag}-m`, passwordHash: 'x', roleId } })).id;
    teamId = (await db.team.create({ data: { code: `${tag}-t`, name: `${tag}-t` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('gives the team a subset, with the reason and who did it on record, and what was summed before is invalidated', async () => {
    const s = await scenario();

    const out = await set(s, ['alpha'], 'Tổ chỉ còn báo alpha');

    expect(out).toEqual({ assignmentId: s.assignmentId, ownedFieldKeys: ['S!C2'], changed: true });
    expect((await db.dynReportAssignment.findUniqueOrThrow({ where: { id: s.assignmentId } })).ownedFieldKeys).toEqual(['S!C2']);
    const history = await db.dynReportAssignmentScopeChange.findMany({ where: { assignmentId: s.assignmentId } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ before: null, after: ['S!C2'], reason: 'Tổ chỉ còn báo alpha', changedById: managerId });
    expect(await db.dynReportSnapshot.count({ where: { periodId: s.periodId, invalidatedAt: null } })).toBe(0);
    // The figure typed for the criterion taken away is kept, just not counted any more.
    expect((await db.dynReportSubmission.findFirstOrThrow({ where: { assignmentId: s.assignmentId } })).values).toEqual({ 'S!C3': { t: 'NUM', v: '9' } });
  });

  it('gives everything back with null: a second line of history, the way back of the first', async () => {
    const s = await scenario();
    await set(s, ['alpha']);

    const out = await set(s, null, 'Trả lại đủ tiêu chí');

    expect(out).toMatchObject({ ownedFieldKeys: null, changed: true });
    const history = await db.dynReportAssignmentScopeChange.findMany({ where: { assignmentId: s.assignmentId }, orderBy: { createdAt: 'asc' } });
    expect(history.map((h) => [h.before, h.after])).toEqual([[null, ['S!C2']], [['S!C2'], null]]);
  });

  it('asking for what the team already has changes nothing and writes no history', async () => {
    const s = await scenario();
    await expect(set(s, ['alpha', 'beta'])).resolves.toMatchObject({ changed: false, ownedFieldKeys: null });
    expect(await db.dynReportAssignmentScopeChange.count({ where: { assignmentId: s.assignmentId } })).toBe(0);
    expect(await db.dynReportSnapshot.count({ where: { periodId: s.periodId, invalidatedAt: null } })).toBe(1);
  });

  it.each([
    [[], 'TARGET_SUBSET_EMPTY'],
    [['khong-co'], 'TARGET_ITEM_KEY_UNKNOWN'],
  ])('refuses %j with %s and writes nothing', async (itemKeys, code) => {
    const s = await scenario();
    await expect(set(s, itemKeys)).rejects.toMatchObject({ code });
    expect((await db.dynReportAssignment.findUniqueOrThrow({ where: { id: s.assignmentId } })).ownedFieldKeys).toBeNull();
  });

  it.each(['SUBMITTED', 'APPROVED'])('a %s submission must be returned first: it was validated against the criteria it had', async (state) => {
    const s = await scenario({ state });
    await expect(set(s, ['alpha'])).rejects.toMatchObject({ code: 'SUBMISSION_MUST_BE_RETURNED' });
    expect((await db.dynReportAssignment.findUniqueOrThrow({ where: { id: s.assignmentId } })).ownedFieldKeys).toBeNull();
  });

  it('a returned submission can be changed (the team will submit again and be validated again)', async () => {
    const s = await scenario({ state: 'RETURNED' });
    await expect(set(s, ['alpha'])).resolves.toMatchObject({ changed: true });
  });

  it('a closed period is not changed', async () => {
    const s = await scenario({ status: 'FINALIZED' });
    await expect(set(s, ['alpha'])).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });

  it('someone who does not manage the report is told the period does not exist', async () => {
    const s = await scenario();
    const stranger = (await db.user.create({ data: { username: `${tag}-x${n}`, passwordHash: 'x', roleId } })).id;
    await expect(set(s, ['alpha'], 'x', stranger)).rejects.toMatchObject({ status: 404 });
  });
});
