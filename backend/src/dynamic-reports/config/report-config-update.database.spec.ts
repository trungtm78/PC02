import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { ReportConfigUpdateService } from './report-config-update.service';
import type { UpdateReportConfigDto } from './dto/update-report-config.dto';

/**
 * "Sửa cấu hình" of an existing report — checked on a REAL PostgreSQL.
 *
 * The rule under test is what is LEFT in the tables: a leaver gets an end date instead of disappearing, the
 * schedule row that was in force is closed and keeps its cursor, a period already generated keeps its teams and
 * editors, and the revision counter moves only when something changed.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('ReportConfigUpdateService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: ReportConfigUpdateService;
  const tag = `cu-${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  const past = new Date('2020-01-01T00:00:00Z');
  const cursor = new Date('2026-10-31T00:00:00Z');

  const SCHEDULE = {
    periodType: 'MONTHLY' as const,
    dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
    openRule: { kind: 'AT_PERIOD_START' },
  };

  /** A published report: one manager (u1), teams t1 (editors u1) and t2 (editors u1, u2), one open period over both. */
  async function buildReport(name: string, status: 'PUBLISHED' | 'ARCHIVED' = 'PUBLISHED') {
    const report = await db.dynReport.create({ data: { code: `${tag}-${name}`, name: `${tag} ${name}`, status, configVersion: 3 } });
    await db.dynReportSchedule.create({
      data: { reportId: report.id, periodType: 'MONTHLY', dueRule: { time: '17:00', days: 5, kind: 'DAYS_AFTER_END' }, openRule: { kind: 'AT_PERIOD_START' }, effectiveFrom: past, lastGeneratedThrough: cursor },
    });
    await db.dynReportRole.create({ data: { reportId: report.id, userId: user.u1, role: 'MANAGER' } });
    for (const [t, editors] of [['t1', ['u1']], ['t2', ['u1', 'u2']]] as const) {
      const target = await db.dynReportTarget.create({ data: { reportId: report.id, teamId: team[t] } });
      for (const e of editors) await db.dynReportTargetEditor.create({ data: { targetId: target.id, userId: user[e] } });
    }
    const version = await db.dynReportVersion.create({
      data: { reportId: report.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64), fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't' },
    });
    const period = await db.dynReportPeriod.create({
      data: { reportId: report.id, periodKey: `${tag}-${name}-P`, startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'), opensAt: past, dueAt: new Date('2099-01-01'), versionId: version.id, scheduleSnapshot: {} },
    });
    for (const t of ['t1', 't2']) {
      const a = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId: team[t], teamSnapshot: {} } });
      await db.dynReportAssignmentEditor.create({ data: { assignmentId: a.id, userId: user.u1, isActive: true } });
    }
    return report.id;
  }

  const baseline = (over: Partial<UpdateReportConfigDto> = {}): UpdateReportConfigDto => ({ expectedConfigVersion: 3, ...over });
  const activeRoles = (reportId: string) => db.dynReportRole.findMany({ where: { reportId, validTo: null }, orderBy: { validFrom: 'asc' } });
  const activeTargets = async (reportId: string) =>
    (await db.dynReportTarget.findMany({ where: { reportId, validTo: null }, include: { editors: { where: { validTo: null } } } }))
      .map((t) => ({ team: t.teamId, editors: t.editors.map((e) => e.userId).sort() }))
      .sort((a, b) => a.team.localeCompare(b.team));

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new ReportConfigUpdateService(db as never);
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    for (const n of ['u1', 'u2', 'u3']) user[n] = (await db.user.create({ data: { username: `${tag}-${n}`, passwordHash: 'x', roleId: role.id } })).id;
    for (const n of ['t1', 't2', 't3']) team[n] = (await db.team.create({ data: { code: `${tag}-${n}`, name: `${tag}-${n}` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('renames, changes the description and clears it with an empty string; the revision moves by one', async () => {
    const id = await buildReport('info');
    await expect(svc.updateConfig(id, baseline({ name: 'Tên mới', description: 'Mô tả mới' }))).resolves.toEqual({ configVersion: 4, changed: ['info'] });
    expect(await db.dynReport.findUnique({ where: { id } })).toMatchObject({ name: 'Tên mới', description: 'Mô tả mới', configVersion: 4 });

    await svc.updateConfig(id, { expectedConfigVersion: 4, description: '' });
    expect((await db.dynReport.findUnique({ where: { id } }))?.description).toBeNull();
  });

  it('a request that changes nothing leaves the revision alone', async () => {
    const id = await buildReport('noop');
    const out = await svc.updateConfig(id, baseline({
      schedule: { ...SCHEDULE }, // same rule, different key order than what is stored
      roles: [{ userId: user.u1, role: 'MANAGER' }],
      targets: [{ teamId: team.t1, editorUserIds: [user.u1] }, { teamId: team.t2, editorUserIds: [user.u2, user.u1] }],
    }));
    expect(out).toEqual({ configVersion: 3, changed: [] });
    expect(await db.dynReportSchedule.count({ where: { reportId: id } })).toBe(1);
  });

  it('a stale revision is refused (REVISION_CONFLICT): two people editing at once cannot overwrite each other', async () => {
    const id = await buildReport('stale');
    await svc.updateConfig(id, baseline({ name: 'A' }));
    await expect(svc.updateConfig(id, baseline({ name: 'B' }))).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    expect((await db.dynReport.findUnique({ where: { id } }))?.name).toBe('A');
  });

  it('a new schedule closes the old one, starts now and keeps the cursor so periods are not made twice', async () => {
    const id = await buildReport('sched');
    const out = await svc.updateConfig(id, baseline({ schedule: { ...SCHEDULE, dueRule: { kind: 'DAYS_AFTER_END', days: 3, time: '09:00' } } }));

    expect(out.changed).toEqual(['schedule']);
    const rows = await db.dynReportSchedule.findMany({ where: { reportId: id }, orderBy: { createdAt: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0].supersededAt).not.toBeNull();
    expect(rows[1].supersededAt).toBeNull();
    expect(rows[1].dueRule).toEqual({ kind: 'DAYS_AFTER_END', days: 3, time: '09:00' });
    expect(rows[1].lastGeneratedThrough?.toISOString()).toBe(cursor.toISOString());
  });

  it('a new calendar (start day) moves the cursor past the periods that exist, so no days belong to two periods (found by Codex)', async () => {
    const id = await buildReport('calendar'); // period 2026-10 ends 2026-10-31; the old cursor is 2026-10-31
    await svc.updateConfig(id, baseline({ schedule: { ...SCHEDULE, periodStartDay: 15 } }));

    const now = (await db.dynReportSchedule.findMany({ where: { reportId: id, supersededAt: null } }))[0];
    // The new-calendar period that contains 2026-11-01 is 10-15..11-14, which would overlap 2026-10: the next one starts 11-15.
    expect(now.lastGeneratedThrough?.toISOString().slice(0, 10)).toBe('2026-11-15');
  });

  it('a new period type does the same (monthly to weekly: the week containing the next day starts inside October)', async () => {
    const id = await buildReport('calendar-type');
    await svc.updateConfig(id, baseline({ schedule: { ...SCHEDULE, periodType: 'WEEKLY', dueRule: { kind: 'FIXED_IN_PERIOD', periodOffset: 1, anchorWeekday: 3, time: '17:00' } } }));

    const now = (await db.dynReportSchedule.findMany({ where: { reportId: id, supersededAt: null } }))[0];
    // 2026-11-01 is a Sunday: its ISO week began on 10-26, inside the last monthly period, so the next week (11-02) is the first.
    expect(now.lastGeneratedThrough?.toISOString().slice(0, 10)).toBe('2026-11-02');
  });

  it('a NEW one-time schedule starts without a cursor (so it makes its period); an unchanged one keeps its cursor (found by Codex)', async () => {
    const id = await buildReport('onetime-cursor');
    const oneTime = { ...SCHEDULE, periodType: 'ONE_TIME' as const, oneTimeDate: '2026-12-15' };
    await svc.updateConfig(id, baseline({ schedule: oneTime }));
    let now = (await db.dynReportSchedule.findMany({ where: { reportId: id, supersededAt: null } }))[0];
    expect(now.lastGeneratedThrough).toBeNull();

    // The scheduler makes the period and sets the cursor; editing only the deadline afterwards must keep it.
    const marked = new Date('2026-12-16T00:00:00Z');
    await db.dynReportSchedule.update({ where: { id: now.id }, data: { lastGeneratedThrough: marked } });
    await svc.updateConfig(id, { expectedConfigVersion: 4, schedule: { ...oneTime, dueRule: { kind: 'DAYS_AFTER_END', days: 9, time: '10:00' } } });
    now = (await db.dynReportSchedule.findMany({ where: { reportId: id, supersededAt: null } }))[0];
    expect(now.lastGeneratedThrough?.toISOString()).toBe(marked.toISOString());
  });

  it('when the calendar does not change, the cursor stays where it was (only deadlines changed)', async () => {
    const id = await buildReport('calendar-same');
    await svc.updateConfig(id, baseline({ schedule: { ...SCHEDULE, dueRule: { kind: 'DAYS_AFTER_END', days: 9, time: '10:00' } } }));
    const now = (await db.dynReportSchedule.findMany({ where: { reportId: id, supersededAt: null } }))[0];
    expect(now.lastGeneratedThrough?.toISOString()).toBe(cursor.toISOString());
  });

  it('a one-time schedule needs its date', async () => {
    const id = await buildReport('onetime');
    await expect(svc.updateConfig(id, baseline({ schedule: { ...SCHEDULE, periodType: 'ONE_TIME' } }))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
    expect(await db.dynReportSchedule.count({ where: { reportId: id } })).toBe(1);
  });

  it('managers: the one who leaves gets an end date (not deleted), the new one starts now', async () => {
    const id = await buildReport('roles');
    const out = await svc.updateConfig(id, baseline({ roles: [{ userId: user.u2, role: 'MANAGER' }, { userId: user.u3, role: 'VIEWER' }] }));

    expect(out.changed).toEqual(['roles']);
    expect((await activeRoles(id)).map((r) => `${r.userId}:${r.role}`).sort()).toEqual([`${user.u2}:MANAGER`, `${user.u3}:VIEWER`].sort());
    const all = await db.dynReportRole.findMany({ where: { reportId: id } });
    expect(all).toHaveLength(3);
    expect(all.find((r) => r.userId === user.u1)?.validTo).not.toBeNull();
  });

  it('a report cannot be left without a manager, and an unknown user is refused; nothing is written', async () => {
    const id = await buildReport('roles-bad');
    await expect(svc.updateConfig(id, baseline({ roles: [{ userId: user.u1, role: 'VIEWER' }] }))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
    await expect(svc.updateConfig(id, baseline({ roles: [{ userId: 'nobody', role: 'MANAGER' }] }))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
    expect((await activeRoles(id)).map((r) => r.userId)).toEqual([user.u1]);
    expect((await db.dynReport.findUnique({ where: { id } }))?.configVersion).toBe(3);
  });

  it('teams: a team that leaves and its editors get an end date; a new team starts with its editors; kept teams change editors', async () => {
    const id = await buildReport('targets');
    const out = await svc.updateConfig(id, baseline({
      targets: [{ teamId: team.t2, editorUserIds: [user.u2, user.u3] }, { teamId: team.t3, editorUserIds: [user.u1] }],
    }));

    expect(out.changed).toEqual(['targets']);
    expect(await activeTargets(id)).toEqual([
      { team: team.t2, editors: [user.u2, user.u3].sort() },
      { team: team.t3, editors: [user.u1] },
    ].sort((a, b) => a.team.localeCompare(b.team)));
    const left = await db.dynReportTarget.findFirst({ where: { reportId: id, teamId: team.t1 }, include: { editors: true } });
    expect(left?.validTo).not.toBeNull();
    expect(left?.editors.every((e) => e.validTo !== null)).toBe(true);
    // The removed editor of a kept team keeps a row with an end date.
    const t2 = await db.dynReportTarget.findFirst({ where: { reportId: id, teamId: team.t2 }, include: { editors: true } });
    expect(t2?.editors.find((e) => e.userId === user.u1)?.validTo).not.toBeNull();
  });

  it('D09: a period already generated keeps its teams and editors, whatever the targets become', async () => {
    const id = await buildReport('d09');
    await svc.updateConfig(id, baseline({ targets: [{ teamId: team.t3, editorUserIds: [user.u3] }] }));

    const assignments = await db.dynReportAssignment.findMany({ where: { period: { reportId: id } }, include: { editors: true } });
    expect(assignments.map((a) => a.teamId).sort()).toEqual([team.t1, team.t2].sort());
    expect(assignments.every((a) => a.editors.some((e) => e.userId === user.u1 && e.isActive))).toBe(true);
  });

  it('target lists are checked: at least one team, an editor for each, no repeats, real teams and users', async () => {
    const id = await buildReport('targets-bad');
    for (const targets of [
      [],
      [{ teamId: team.t1, editorUserIds: [] }],
      [{ teamId: team.t1, editorUserIds: [user.u1] }, { teamId: team.t1, editorUserIds: [user.u2] }],
      [{ teamId: 'no-such-team', editorUserIds: [user.u1] }],
      [{ teamId: team.t1, editorUserIds: ['no-such-user'] }],
    ]) {
      await expect(svc.updateConfig(id, baseline({ targets }))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
    }
    expect(await activeTargets(id)).toHaveLength(2);
  });

  it('an archived report must be restored first; a missing one is not found', async () => {
    const id = await buildReport('arch', 'ARCHIVED');
    await expect(svc.updateConfig(id, baseline({ name: 'x' }))).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(svc.updateConfig('missing', baseline({ name: 'x' }))).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('everything is all-or-nothing: a bad part after a good part writes nothing at all', async () => {
    const id = await buildReport('atomic');
    await expect(
      svc.updateConfig(id, baseline({ name: 'Không được ghi', schedule: { ...SCHEDULE, dueRule: { kind: 'DAYS_AFTER_END', days: 1, time: '08:00' } }, targets: [] })),
    ).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });

    expect((await db.dynReport.findUnique({ where: { id } }))).toMatchObject({ name: `${tag} atomic`, configVersion: 3 });
    expect(await db.dynReportSchedule.count({ where: { reportId: id } })).toBe(1);
  });
});
