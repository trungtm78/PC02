import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { SubmissionService } from './submission.service';
import { VersionFieldsCacheService } from '../template/version-fields-cache';

/**
 * Asking a manager to reopen a submission, and what the editor can do once it is approved — on a REAL PostgreSQL.
 *
 * Found on production (13/10/2026): the manager approved the request, the grant showed as active, and the editor
 * still saw the report locked and every save answered 409 REPORT_LOCKED. A grant extends the window of a submission
 * that can still be edited; a SUBMITTED one cannot be edited at all, so the grant did nothing. The unit tests never saw
 * it because they only checked that a row became ACTIVE, never that the editor could then type.
 *
 * These follow the whole path: submitted → request → approve → the editor types → submits again.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('reopening a submission on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: SubmissionService;
  const tag = `ur-${randomUUID().slice(0, 8)}`;
  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');
  const user: Record<string, string> = {};
  let roleUser = '';
  let teamId = '';
  const events: Array<{ name: string }> = [];

  /** An open period with one team; the submission starts in `state` with a figure already saved. */
  async function build(name: string, state: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED', dueAt = future) {
    const report = await db.dynReport.create({ data: { code: `${tag}-${name}`, name: `${tag} ${name}`, status: 'PUBLISHED' } });
    const version = await db.dynReportVersion.create({
      data: { reportId: report.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64), fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't' },
    });
    await db.dynReportField.create({
      data: { versionId: version.id, sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Số vụ', type: 'NUM', aggregate: 'SUM', source: 'WEB' },
    });
    await db.dynReportRole.create({ data: { reportId: report.id, userId: user.mgr, role: 'MANAGER' } });
    const period = await db.dynReportPeriod.create({
      data: { reportId: report.id, periodKey: `${tag}-${name}-P`, startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'), opensAt: past, dueAt, versionId: version.id, scheduleSnapshot: {} },
    });
    const assignment = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId, teamSnapshot: { name: 'Đội' } } });
    await db.dynReportAssignmentEditor.create({ data: { assignmentId: assignment.id, userId: user.editor, isActive: true } });
    await db.dynReportSubmission.create({
      data: {
        assignmentId: assignment.id,
        state,
        currentRevision: state === 'NOT_STARTED' ? 0 : 1,
        values: state === 'NOT_STARTED' ? {} : { 'S!C3': { t: 'NUM', v: '5' } },
        firstSavedAt: state === 'NOT_STARTED' ? null : new Date(),
        approvalLevel: state === 'APPROVED' ? 1 : 0,
      },
    });
    return { assignmentId: assignment.id, reportId: report.id };
  }

  const view = (assignmentId: string) => svc.getSubmission(assignmentId, user.editor);
  const state = async (assignmentId: string) => (await db.dynReportSubmission.findUnique({ where: { assignmentId } }))!;

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new SubmissionService(
      db as never,
      { emit: (name: string) => events.push({ name }) } as never,
      new VersionFieldsCacheService(),
      {} as never,
    );
    roleUser = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    for (const n of ['mgr', 'editor']) user[n] = (await db.user.create({ data: { username: `${tag}-${n}`, passwordHash: 'x', roleId: roleUser } })).id;
    teamId = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag}-T` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function requestAndApprove(assignmentId: string) {
    const req = await svc.requestUnlock(assignmentId, user.editor, 'Nhập nhầm số vụ');
    await svc.decideRequest(req.id, user.mgr, roleUser, 'APPROVE');
    return req.id;
  }

  it('REGRESSION: a submitted report, once its reopening is approved, can be edited and submitted again', async () => {
    const { assignmentId } = await build('submitted', 'SUBMITTED');
    expect((await view(assignmentId)).editable).toBe(false);

    await requestAndApprove(assignmentId);

    const after = await view(assignmentId);
    expect(after.editable).toBe(true); // was false: the bug
    expect(after.state).toBe('RETURNED');
    expect(after.effectiveLockAt).not.toBeNull();

    const saved = await svc.save(assignmentId, user.editor, { 'S!C3': '7' }, after.revision);
    expect(saved.state).toBe('DRAFT');
    const resubmitted = await svc.submit(assignmentId, user.editor, saved.revision)
    expect(resubmitted.state).toBe('SUBMITTED');
    expect(((await state(assignmentId)).values as Record<string, { v: string }>)['S!C3'].v).toBe('7');
  });

  it('the reopening is a "Trả lại" in the history: revision of kind RETURN with the reason, the deadline is the grant\'s expiry', async () => {
    const { assignmentId } = await build('history', 'SUBMITTED');
    await requestAndApprove(assignmentId);

    const sub = await state(assignmentId);
    const grant = await db.dynReportUnlock.findFirst({ where: { assignmentId, status: 'ACTIVE' } });
    expect(sub.state).toBe('RETURNED');
    expect(sub.returnDueAt?.toISOString()).toBe(grant?.expiresAt.toISOString());
    const last = await db.dynReportRevision.findFirst({ where: { submissionId: sub.id }, orderBy: { revision: 'desc' } });
    expect(last).toMatchObject({ kind: 'RETURN' });
    expect(last?.reason).toBeTruthy();
    expect(sub.approvalLevel).toBe(0);
  });

  it('the request and the return happen together: a request that cannot reopen stays PENDING (an approved report)', async () => {
    const { assignmentId } = await build('approved', 'APPROVED');
    const req = await svc.requestUnlock(assignmentId, user.editor, 'Cần sửa');

    await expect(svc.decideRequest(req.id, user.mgr, roleUser, 'APPROVE')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

    expect((await db.dynReportUnlock.findUnique({ where: { id: req.id } }))?.status).toBe('PENDING');
    expect((await state(assignmentId)).state).toBe('APPROVED');
    expect(await db.dynReportUnlock.count({ where: { assignmentId, status: 'ACTIVE' } })).toBe(0);
  });

  it('a manager\'s own grant (not a request) on a submitted report works the same way', async () => {
    const { assignmentId } = await build('grant', 'SUBMITTED');
    await svc.grantUnlock(assignmentId, user.mgr, roleUser, 'Bổ sung số liệu');

    const after = await view(assignmentId);
    expect(after.editable).toBe(true);
    expect(after.state).toBe('RETURNED');
  });

  it('and a grant on an approved report is refused with what to do first, and writes nothing', async () => {
    const { assignmentId } = await build('grant-approved', 'APPROVED');
    await expect(svc.grantUnlock(assignmentId, user.mgr, roleUser, 'x')).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(await db.dynReportUnlock.count({ where: { assignmentId } })).toBe(0);
    expect((await state(assignmentId)).state).toBe('APPROVED');
  });

  it('bulk grant reopens the submitted ones and reports the approved one as skipped, with the reason', async () => {
    const a = await build('bulk-a', 'SUBMITTED');
    const b = await build('bulk-b', 'APPROVED');
    // The two assignments are in different reports; the same manager manages both.
    const out = await svc.bulkGrantUnlock([a.assignmentId, b.assignmentId], user.mgr, roleUser, 'Đợt sửa số liệu');

    expect(out.granted).toEqual([a.assignmentId]);
    expect(out.skipped).toEqual([{ assignmentId: b.assignmentId, error: expect.stringContaining('Huỷ duyệt') }]);
    expect((await state(a.assignmentId)).state).toBe('RETURNED');
    expect(await db.dynReportUnlock.count({ where: { assignmentId: b.assignmentId } })).toBe(0);
  });

  it('revoking the grant closes the window at once, even though the return deadline was the grant\'s expiry', async () => {
    const { assignmentId } = await build('revoke', 'SUBMITTED');
    await requestAndApprove(assignmentId);
    expect((await view(assignmentId)).editable).toBe(true);

    await svc.revokeActiveGrant(assignmentId, user.mgr, roleUser, 'Thu hồi');

    const after = await view(assignmentId);
    expect(after.editable).toBe(false);
    expect((await state(assignmentId)).returnDueAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('CONTROL: a draft past its deadline is still opened by a plain grant (the case the grant was built for), state untouched', async () => {
    const { assignmentId } = await build('late-draft', 'DRAFT', new Date('2026-01-01T00:00:00Z'));
    expect((await view(assignmentId)).editable).toBe(false);

    await requestAndApprove(assignmentId);

    const after = await view(assignmentId);
    expect(after.editable).toBe(true);
    expect(after.state).toBe('DRAFT');
    expect((await state(assignmentId)).currentRevision).toBe(BigInt(1)); // no extra revision: nothing was returned
  });

  it('the database clock is read as the real instant whatever the server TimeZone is: a deadline 2 hours ahead is in the future (found with the 3-hour unlock window)', async () => {
    const { assignmentId } = await build('clock', 'SUBMITTED');
    const sub = await state(assignmentId);
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    // Before the fix the clock read 7 hours ahead on an Asia/Ho_Chi_Minh server, so this "future" deadline was refused.
    await expect(svc.returnSubmission(assignmentId, user.mgr, roleUser, sub.currentRevision.toString(), 'Sửa lại số liệu', inTwoHours)).resolves.toMatchObject({ state: 'RETURNED' });
    expect((await view(assignmentId)).editable).toBe(true);
  });

  it('a never-started submission past its deadline is opened the same way', async () => {
    const { assignmentId } = await build('late-new', 'NOT_STARTED', new Date('2026-01-01T00:00:00Z'));
    await requestAndApprove(assignmentId);
    expect((await view(assignmentId)).editable).toBe(true);
  });
});
