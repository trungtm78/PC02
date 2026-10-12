import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { GridAccessService } from './grid-access.service';

/**
 * Who may read a version's grid — checked on a REAL PostgreSQL.
 *
 * A fake Prisma only proves the query's shape; the boundary that matters is the
 * data: a manager of ANOTHER report, an expired role, an editor whose seat was
 * replaced, a draft version, a version the caller has no tie to. Those only
 * show up with rows in real tables.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database
 * (127.0.0.1, name pc02_dynamic_reports_test or pc02_goiy_scope_test);
 * otherwise skipped. In CI DYN_REPORTS_DATABASE_REQUIRED=1 turns a missing URL
 * into a FAILURE — a gate that silently does not run is worse than no gate.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory in CI (DYN_REPORTS_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

run('GridAccessService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: GridAccessService;
  const tag = `ga-${randomUUID().slice(0, 8)}`;

  // Principals
  let roleAdmin = '';
  let roleManage = '';
  let roleReader = '';
  const user: Record<string, string> = {};
  // Reports / versions
  let reportA = '';
  let reportB = '';
  let versionAPublished = '';
  let versionADraft = '';
  let versionB = '';
  let assignmentA = '';

  const farFuture = new Date('2099-01-01T00:00:00Z');
  const past = new Date('2020-01-01T00:00:00Z');

  async function perm(action: string): Promise<string> {
    const p = await db.permission.upsert({
      where: { action_subject: { action, subject: 'DynamicReport' } },
      update: {},
      create: { action, subject: 'DynamicReport' },
    });
    return p.id;
  }

  async function role(name: string, actions: string[]): Promise<string> {
    const r = await db.role.create({ data: { name: `${tag}-${name}` } });
    for (const a of actions) {
      await db.rolePermission.create({ data: { roleId: r.id, permissionId: await perm(a) } });
    }
    return r.id;
  }

  async function makeUser(name: string, roleId: string): Promise<string> {
    const u = await db.user.create({
      data: { username: `${tag}-${name}`, passwordHash: 'x', roleId },
    });
    user[name] = u.id;
    return u.id;
  }

  async function makeVersion(reportId: string, version: number, status: 'DRAFT' | 'PUBLISHED'): Promise<string> {
    const v = await db.dynReportVersion.create({
      data: {
        reportId,
        version,
        status,
        fileBytes: Buffer.from('x'),
        sha256: 'f'.repeat(64),
        fileName: 'm.xlsx',
        selectedSheets: ['S'],
        layout: {},
        parserVersion: 't',
        engineVersion: 't',
      },
    });
    return v.id;
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new GridAccessService(db as never);

    roleAdmin = await role('admin', ['read', 'admin']);
    roleManage = await role('manage', ['read', 'manage']);
    roleReader = await role('reader', ['read']);

    for (const n of ['admin', 'manage', 'mgrA', 'viewerA', 'expiredA', 'mgrB', 'editorA', 'oldEditorA', 'stranger']) {
      await makeUser(n, n === 'admin' ? roleAdmin : n === 'manage' ? roleManage : roleReader);
    }

    reportA = (await db.dynReport.create({ data: { code: `${tag}-A`, name: `${tag} A`, status: 'PUBLISHED' } })).id;
    reportB = (await db.dynReport.create({ data: { code: `${tag}-B`, name: `${tag} B`, status: 'PUBLISHED' } })).id;
    versionAPublished = await makeVersion(reportA, 1, 'PUBLISHED');
    versionADraft = await makeVersion(reportA, 2, 'DRAFT');
    versionB = await makeVersion(reportB, 1, 'PUBLISHED');

    await db.dynReportRole.create({ data: { reportId: reportA, userId: user.mgrA, role: 'MANAGER' } });
    await db.dynReportRole.create({ data: { reportId: reportA, userId: user.viewerA, role: 'VIEWER' } });
    await db.dynReportRole.create({
      data: { reportId: reportA, userId: user.expiredA, role: 'MANAGER', validFrom: past, validTo: new Date('2020-06-01T00:00:00Z') },
    });
    await db.dynReportRole.create({ data: { reportId: reportB, userId: user.mgrB, role: 'MANAGER' } });

    const team = await db.team.create({ data: { code: `${tag}-T`, name: `${tag}-T` } });
    const period = await db.dynReportPeriod.create({
      data: {
        reportId: reportA,
        periodKey: `${tag}-P`,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        opensAt: past,
        dueAt: farFuture,
        versionId: versionAPublished,
        scheduleSnapshot: {},
      },
    });
    assignmentA = (
      await db.dynReportAssignment.create({ data: { periodId: period.id, teamId: team.id, teamSnapshot: {} } })
    ).id;
    await db.dynReportAssignmentEditor.create({ data: { assignmentId: assignmentA, userId: user.editorA, isActive: true } });
    await db.dynReportAssignmentEditor.create({ data: { assignmentId: assignmentA, userId: user.oldEditorA, isActive: false } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.dynReportAssignmentEditor.deleteMany({ where: { assignmentId: assignmentA } });
    await db.dynReportAssignment.deleteMany({ where: { id: assignmentA } });
    await db.dynReportPeriod.deleteMany({ where: { periodKey: `${tag}-P` } });
    await db.dynReportRole.deleteMany({ where: { reportId: { in: [reportA, reportB] } } });
    await db.dynReportVersion.deleteMany({ where: { reportId: { in: [reportA, reportB] } } });
    await db.dynReport.deleteMany({ where: { id: { in: [reportA, reportB] } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.rolePermission.deleteMany({ where: { role: { name: { startsWith: tag } } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await db.$disconnect();
  });

  const roleOf = (who: string) =>
    who === 'admin' ? roleAdmin : who === 'manage' ? roleManage : roleReader;
  const can = (who: string, versionId: string) => svc.canReadVersion(user[who], roleOf(who), versionId);

  it('admin:DynamicReport reads any version, drafts included', async () => {
    expect(await can('admin', versionAPublished)).toBe(true);
    expect(await can('admin', versionADraft)).toBe(true);
    expect(await can('admin', versionB)).toBe(true);
  });

  it('manage:DynamicReport likewise (it is the setup permission)', async () => {
    expect(await can('manage', versionADraft)).toBe(true);
    expect(await can('manage', versionB)).toBe(true);
  });

  it("a report's manager and viewer read its published versions", async () => {
    expect(await can('mgrA', versionAPublished)).toBe(true);
    expect(await can('viewerA', versionAPublished)).toBe(true);
  });

  it('…but not its draft: a draft is for the people who set the report up', async () => {
    expect(await can('mgrA', versionADraft)).toBe(false);
    expect(await can('viewerA', versionADraft)).toBe(false);
  });

  it("a manager of ANOTHER report cannot read this one, and vice versa", async () => {
    expect(await can('mgrB', versionAPublished)).toBe(false);
    expect(await can('mgrA', versionB)).toBe(false);
  });

  it('an expired role no longer reads', async () => {
    expect(await can('expiredA', versionAPublished)).toBe(false);
  });

  it('an active editor of an assignment on this version reads it', async () => {
    expect(await can('editorA', versionAPublished)).toBe(true);
  });

  it('an editor whose seat was replaced (isActive=false) does not', async () => {
    expect(await can('oldEditorA', versionAPublished)).toBe(false);
  });

  it("an editor's tie is to THIS version only", async () => {
    expect(await can('editorA', versionB)).toBe(false);
    expect(await can('editorA', versionADraft)).toBe(false);
  });

  it('a user with no tie at all reads nothing', async () => {
    expect(await can('stranger', versionAPublished)).toBe(false);
    expect(await can('stranger', versionB)).toBe(false);
  });

  it('a version that does not exist is simply not readable', async () => {
    expect(await can('admin', 'does-not-exist')).toBe(false);
  });
});
