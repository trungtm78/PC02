import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { installTriggerSection } from '../../common/testing/install-trigger-section';
import { LEADERSHIP_PERMISSIONS, STARTER_TEMPLATES, WARD_INTAKE_PERMISSIONS, WARD_REVIEW_PERMISSIONS, WARD_SUBMIT_PERMISSIONS } from '../admin/starter-templates';
import { CHART_UNITS, MOVE_SOURCE_TEAM_ID, MOVE_TARGET_TEAM_ID } from './pc02-unit-chart';
import { runUnitChart, type RunResult } from './ap-so-do-pc02';

/**
 * The CLI end to end on a real PostgreSQL, with a miniature of production (the team ids of the chart, a few records on
 * "Tổ công tác Số 2", some unassigned, an administrator among its members). Expected numbers are counted BY HAND from
 * the fixture below and the specification of the reaches, never by running the code.
 *
 * Fixture (P = petitions, I = incidents, C = cases; "by x" = the owner):
 *   ct02: a-admin (ADMIN, leader), a-officer        P1 by a-officer, P2 by nobody, P3 by a-officer DELETED; I1; C1 by a-officer
 *   doi2: b-officer (data access grant READ on doi4) P6
 *   sub2 (under doi2, no configuration): b-sub      P8 by b-sub
 *   doi4: c4-officer                                 P7 by c4-officer
 *   doi1: d1-officer                                 P9 by d1-officer
 *   unassigned                                       P4 by b-officer, P5 by nobody; I2 investigator a-officer
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const OFFICER_PERMS = ['read:Petition', 'write:Petition', 'edit:Petition', 'read:Incident', 'read:Case', 'read:Directory'];

run('ap-so-do-pc02 end to end on PostgreSQL', () => {
  jest.setTimeout(240_000);
  let db: PrismaClient;
  let pg: Client;
  const tag = `chart-${randomUUID().slice(0, 6)}`;
  const id: Record<string, string> = {};
  const createdRoles: string[] = [];
  let outDir: string;
  let lines: string[] = [];
  const print = (l: string) => lines.push(l);
  const repoRoot = join(__dirname, '../../../..');
  const extraTeamIds = [`${tag}-sub2`, `${tag}-other`];
  const chartTeamIds = CHART_UNITS.map((u) => u.teamId);
  const allTeamIds = [...chartTeamIds, ...extraTeamIds];
  const accountNames = CHART_UNITS.flatMap((u) => [`${u.slug}.truong`, `${u.slug}.canbo`]);
  let unassignedBaseline = { petitions: 0, incidents: 0, cases: 0 };

  async function cleanup() {
    const users = await db.user.findMany({ where: { OR: [{ username: { startsWith: tag } }, { username: { in: accountNames } }] }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await db.teamRecordMove.deleteMany({ where: { OR: [{ sourceTeamId: MOVE_SOURCE_TEAM_ID }, { targetTeamId: MOVE_TARGET_TEAM_ID }] } });
    // Steps of a flow are written without their flow (foreign keys off for this session only): fixture rows only.
    await pg.query(`SET session_replication_role = replica`);
    await pg.query(`DELETE FROM proc_record_step_parties WHERE id LIKE $1`, [`${tag}%`]);
    await pg.query(`DELETE FROM proc_record_steps WHERE id LIKE $1`, [`${tag}%`]);
    await pg.query(`SET session_replication_role = origin`);
    await db.caseHandoff.deleteMany({ where: { reason: { startsWith: tag } } });
    await db.incidentHandoff.deleteMany({ where: { requestKey: { startsWith: tag } } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.dataAccessGrant.deleteMany({ where: { granteeId: { in: userIds } } });
    await db.userTeam.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { teamId: { in: allTeamIds } }] } });
    await db.teamPermissionOverride.deleteMany({ where: { teamId: { in: allTeamIds } } });
    await db.teamPermissionConfig.deleteMany({ where: { teamId: { in: allTeamIds } } });
    await db.permissionChangeSet.deleteMany({ where: { actorId: { in: userIds } } });
    const starters = await db.permissionTemplate.findMany({ where: { code: { in: STARTER_TEMPLATES.map((t) => t.code) }, memberOfTeams: { none: {} }, leaderOfTeams: { none: {} } }, select: { id: true } });
    await db.permissionTemplateEntry.deleteMany({ where: { templateId: { in: starters.map((t) => t.id) } } });
    await db.permissionTemplate.deleteMany({ where: { id: { in: starters.map((t) => t.id) } } });
    await db.team.deleteMany({ where: { id: { in: [...extraTeamIds, 'team_doi1_to1_pc02', 'team_doi1_to2_pc02', 'team_doi1_to3_pc02'] } } });
    await db.team.deleteMany({ where: { id: { in: chartTeamIds } } });
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { subjectId: { in: [...userIds, ...allTeamIds] } }] } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const counts = async (table: 'petitions' | 'incidents' | 'cases', where: string) =>
    Number((await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`))[0].n);

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test', '/pc02_unit_chart_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');
    await cleanup();
    outDir = mkdtempSync(join(tmpdir(), 'so-do-pc02-'));

    const keys = [...new Set([...OFFICER_PERMS, ...LEADERSHIP_PERMISSIONS, ...WARD_SUBMIT_PERMISSIONS, ...WARD_REVIEW_PERMISSIONS, ...WARD_INTAKE_PERMISSIONS, 'write:Role', 'read:Role'])];
    const perm: Record<string, string> = {};
    for (const key of keys) {
      const [action, subject] = key.split(':');
      perm[key] = (await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } })).id;
    }
    for (const [name, held] of [['OFFICER', OFFICER_PERMS], ['ADMIN', keys]] as const) {
      const existing = await db.role.findUnique({ where: { name }, select: { id: true } });
      if (existing) {
        id[name] = existing.id;
        for (const key of held) {
          await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: existing.id, permissionId: perm[key] } }, update: {}, create: { roleId: existing.id, permissionId: perm[key] } });
        }
      } else {
        id[name] = (await db.role.create({ data: { name, permissions: { create: held.map((k) => ({ permissionId: perm[k] })) } } })).id;
        createdRoles.push(id[name]);
      }
    }

    for (const unit of CHART_UNITS.filter((x) => !x.create)) {
      await db.team.create({ data: { id: unit.teamId, code: `${tag}-${unit.slug}`, name: `${tag} ${unit.label}`, level: 1 } });
    }
    await db.team.create({ data: { id: `${tag}-sub2`, code: `${tag}-sub2`, name: `${tag} Nhóm dưới Đội 2`, parentId: 'team_doi2_pc02', level: 2 } });
    await db.team.create({ data: { id: `${tag}-other`, code: `${tag}-other`, name: `${tag} Tổ ngoài sơ đồ`, level: 1 } });

    const user = async (name: string, role: 'OFFICER' | 'ADMIN', teamId: string | null, isLeader = false) => {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: id[role], isActive: true } })).id;
      if (teamId) await db.userTeam.create({ data: { userId: id[name], teamId, isLeader } });
    };
    await user('actor', 'ADMIN', null);
    await user('a-admin', 'ADMIN', MOVE_SOURCE_TEAM_ID, true);
    await user('a-officer', 'OFFICER', MOVE_SOURCE_TEAM_ID);
    await user('b-officer', 'OFFICER', 'team_doi2_pc02');
    await user('b-sub', 'OFFICER', `${tag}-sub2`);
    await user('c4-officer', 'OFFICER', 'team_doi4_pc02');
    await user('d1-officer', 'OFFICER', 'team_doi1_pc02');
    await db.dataAccessGrant.create({ data: { granteeId: id['b-officer'], teamId: 'team_doi4_pc02', accessLevel: 'READ', grantedById: id.actor } as never });
    // Outside the chart, reaching Tổ công tác Số 2 only through a data access grant.
    await user('g-outsider', 'OFFICER', `${tag}-other`);
    await db.dataAccessGrant.create({ data: { granteeId: id['g-outsider'], teamId: MOVE_SOURCE_TEAM_ID, accessLevel: 'READ', grantedById: id.actor } as never });

    unassignedBaseline = {
      petitions: await counts('petitions', `"assignedTeamId" IS NULL AND "deletedAt" IS NULL`),
      incidents: await counts('incidents', `"assignedTeamId" IS NULL AND "deletedAt" IS NULL`),
      cases: await counts('cases', `"assignedTeamId" IS NULL AND "deletedAt" IS NULL`),
    };
    const petition = async (name: string, by: string | null, teamId: string | null, deleted = false) => {
      id[name] = (
        await db.petition.create({
          data: { stt: `${tag}-${name}`, receivedDate: new Date('2026-01-05T00:00:00Z'), senderName: name, enteredById: by ? id[by] : null, assignedTeamId: teamId, deletedAt: deleted ? new Date() : null } as never,
        })
      ).id;
    };
    await petition('P1', 'a-officer', MOVE_SOURCE_TEAM_ID);
    await petition('P2', null, MOVE_SOURCE_TEAM_ID);
    await petition('P3', 'a-officer', MOVE_SOURCE_TEAM_ID, true);
    await petition('P4', 'b-officer', null);
    await petition('P5', null, null);
    await petition('P6', null, 'team_doi2_pc02');
    await petition('P7', 'c4-officer', 'team_doi4_pc02');
    await petition('P8', 'b-sub', `${tag}-sub2`);
    await petition('P9', 'd1-officer', 'team_doi1_pc02');
    id.I1 = (await db.incident.create({ data: { code: `${tag}-I1`, name: 'I1', assignedTeamId: MOVE_SOURCE_TEAM_ID } as never })).id;
    id.I2 = (await db.incident.create({ data: { code: `${tag}-I2`, name: 'I2', investigatorId: id['a-officer'] } as never })).id;
    id.C1 = (await db.case.create({ data: { name: `${tag}-C1`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id['a-officer'], assignedTeamId: MOVE_SOURCE_TEAM_ID } as never })).id;
    // A case sent to Tổ công tác Số 2 for a-officer, waiting; one already received (history: it stays).
    id.H1 = (await db.caseHandoff.create({ data: { caseId: id.C1, toTeamId: MOVE_SOURCE_TEAM_ID, sentById: id['d1-officer'], recipientId: id['a-officer'], reason: `${tag}-pending` } as never })).id;
    id.H2 = (await db.caseHandoff.create({ data: { caseId: id.C1, toTeamId: MOVE_SOURCE_TEAM_ID, sentById: id['d1-officer'], state: 'RECEIVED', reason: `${tag}-received` } as never })).id;
    id.H3 = (await db.incidentHandoff.create({ data: { incidentId: id.I1, toTeamId: MOVE_SOURCE_TEAM_ID, sentById: id['d1-officer'], requestKey: `${tag}-k1`, requestHash: 'h' } as never })).id;
    // The unit holding P1 and P2 on a step of their flows.
    await pg.query(`SET session_replication_role = replica`);
    for (const p of ['P1', 'P2']) {
      await pg.query(
        `INSERT INTO proc_record_steps (id, "recordFlowId", "recordKind", "recordId", "stepId", "stepKey", "order", "updatedAt") VALUES ($1, $3, 'PETITION', $2, 'x', 'x', 1, now())`,
        [`${tag}-step-${p}`, id[p], `${tag}-flow-${p}`],
      );
      await pg.query(
        `INSERT INTO proc_record_step_parties (id, "recordStepId", "partyKind", "teamId", role, "order") VALUES ($1, $2, 'RECORD_TEAM', $3, 'MAIN', 1)`,
        [`${tag}-party-${p}`, `${tag}-step-${p}`, MOVE_SOURCE_TEAM_ID],
      );
    }
    await pg.query(`SET session_replication_role = origin`);
  });

  afterAll(async () => {
    await cleanup();
    for (const roleId of createdRoles) {
      await db.rolePermission.deleteMany({ where: { roleId } });
      await db.role.deleteMany({ where: { id: roleId } });
    }
    rmSync(outDir, { recursive: true, force: true });
    await pg.end();
    await db.$disconnect();
  });

  /** Everything a run could write, counted. */
  const footprint = async () => ({
    teams: await db.team.count(),
    users: await db.user.count(),
    memberships: await db.userTeam.findMany({ orderBy: [{ userId: 'asc' }, { teamId: 'asc' }], select: { userId: true, teamId: true, isLeader: true } }),
    configs: await db.teamPermissionConfig.count(),
    templates: await db.permissionTemplate.count(),
    changeSets: await db.permissionChangeSet.count(),
    moves: await db.teamRecordMove.count(),
    audit: await db.auditLog.count(),
    onSource: await counts('petitions', `"assignedTeamId" = '${MOVE_SOURCE_TEAM_ID}'`),
  });
  const person = (result: RunResult, name: string) => result.people.find((p) => p.username === (name.includes('.') ? name : `${tag}-${name}`))!;
  const plus = (c: { petitions: number; incidents: number; cases: number }, extra = unassignedBaseline) => ({
    petitions: c.petitions + extra.petitions,
    incidents: c.incidents + extra.incidents,
    cases: c.cases + extra.cases,
  });
  const none = { petitions: 0, incidents: 0, cases: 0 };

  let dry: RunResult;
  let real: RunResult;
  const opts = (over: Partial<Parameters<typeof runUnitChart>[0]> = {}) => ({ apply: false, outPath: null, actorUsername: null, undoMoveId: null, keepChildren: true, ...over });
  const teamOf = {
    petition: async (key: string) => (await db.petition.findUnique({ where: { id: id[key] } }))!.assignedTeamId,
    party: async (p: string) => (await pg.query<{ teamId: string }>(`SELECT "teamId" FROM proc_record_step_parties WHERE id = $1`, [`${tag}-party-${p}`])).rows[0].teamId,
  };

  it('a team under a unit with no configuration of its own stops a real run, unless --giu-cau-hinh-to-con', async () => {
    const was = await footprint();
    lines = [];
    const refused = await runUnitChart(opts({ apply: true, keepChildren: false, actorUsername: `${tag}-actor`, outPath: join(outDir, 'x.xlsx') }), { db, print, repoRoot });
    expect(refused.plan!.blockers).toEqual([expect.stringMatching(new RegExp(`${tag} Nhóm dưới Đội 2 \\(theo ${tag} Đội 2\\).*--giu-cau-hinh-to-con`))]);
    expect(refused.refused).toMatch(/còn vướng/);
    expect(await footprint()).toEqual(was);
  });

  it('a dry run writes nothing at all, prints no password, and says what its counts leave out', async () => {
    const was = await footprint();
    lines = [];
    dry = await runUnitChart(opts(), { db, print, repoRoot });
    expect(dry.refused).toBeNull();
    expect(dry.plan!.blockers).toEqual([]);
    expect(await footprint()).toEqual(was);
    const text = lines.join('\n');
    expect(text).toContain('CHẠY THỬ: chưa ghi gì');
    expect(text).not.toMatch(/[A-Z][a-z]+-[A-Z][a-z]+@\d{4}/);
    // The counts are by team scope only: the column and one line say so.
    expect(text).toContain('theo phạm vi tổ (chưa tính độ mật của vụ án)');
    expect(lines.filter((l) => l.includes('vụ án mật'))).toHaveLength(1);
    // The pending hand-offs to the source are part of the move.
    expect(dry.plan!.move).toMatchObject({ status: 'TODO', records: { pendingHandoffs: 2 } });
  });

  it('the dry run counts, before and after, what each person reads: equal to the counts by hand', () => {
    // BEFORE: every team as today (the team, the teams under it, its people's records, unassigned records).
    expect(person(dry, 'a-officer').before).toEqual(plus({ petitions: 4, incidents: 2, cases: 1 }));
    expect(person(dry, 'b-officer').before).toEqual(plus({ petitions: 5, incidents: 1, cases: 0 }));
    expect(person(dry, 'b-sub').before).toEqual(plus({ petitions: 3, incidents: 1, cases: 0 }));
    expect(person(dry, 'c4-officer').before).toEqual(plus({ petitions: 3, incidents: 1, cases: 0 }));
    expect(person(dry, 'd1-officer').before).toEqual(plus({ petitions: 3, incidents: 1, cases: 0 }));
    expect(person(dry, 'a-admin').allBefore).toBe('ADMIN');
    // AFTER: exactly the own team plus one's own; Đội 1 as today over itself and Tổ 1/2/3; the team under Đội 2 kept.
    expect(person(dry, 'a-officer').after).toEqual({ petitions: 2, incidents: 2, cases: 1 });
    expect(person(dry, 'b-officer').after).toEqual({ petitions: 3, incidents: 0, cases: 0 });
    expect(person(dry, 'b-sub').after).toEqual(person(dry, 'b-sub').before);
    expect(person(dry, 'c4-officer').after).toEqual({ petitions: 1, incidents: 0, cases: 0 });
    expect(person(dry, 'd1-officer').after).toEqual(plus({ petitions: 5, incidents: 2, cases: 1 }));
    expect(person(dry, 'a-admin').allAfter).toBe('ADMIN');
    expect(person(dry, 'tct2.canbo').after).toEqual(none);
    expect(person(dry, 'to2.doi1.canbo').after).toEqual({ petitions: 2, incidents: 1, cases: 1 });
    expect(person(dry, 'to2.doi1.canbo').before).toBeNull();
    // What else widens a reach is listed, not removed.
    expect(person(dry, 'b-officer').widening).toEqual([expect.stringMatching(/ủy quyền dữ liệu: READ/)]);
  });

  it('somebody outside the chart who reaches Tổ công tác Số 2 through a data access grant is counted and listed', () => {
    const g = person(dry, 'g-outsider');
    expect(g).toBeDefined();
    expect(g.before).toEqual(plus({ petitions: 4, incidents: 2, cases: 1 }));
    expect(g.after).toEqual(plus({ petitions: 2, incidents: 1, cases: 0 }));
    expect(g.widening).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`ủy quyền dữ liệu: READ tổ ${tag} Tổ công tác Số 2`))]));
  });

  it('a real run is refused without an administrator, without --ra, or with --ra inside the repository', async () => {
    const was = await footprint();
    expect((await runUnitChart(opts({ apply: true }), { db, print, repoRoot })).refused).toMatch(/nguoi-thuc-hien/);
    expect((await runUnitChart(opts({ apply: true, actorUsername: `${tag}-a-officer` }), { db, print, repoRoot })).refused).toMatch(/quản trị/);
    expect((await runUnitChart(opts({ apply: true, actorUsername: `${tag}-actor` }), { db, print, repoRoot })).refused).toMatch(/--ra/);
    expect((await runUnitChart(opts({ apply: true, outPath: join(repoRoot, 'so-do.xlsx'), actorUsername: `${tag}-actor` }), { db, print, repoRoot })).refused).toMatch(/kho mã/);
    expect(await footprint()).toEqual(was);
  });

  it('when the configuration step fails, nobody has been moved (the permissions are set before the people move)', async () => {
    const beforeStep = async (step: string) => {
      if (step === 'configs') throw new Error('configuration step failed');
    };
    await expect(runUnitChart(opts({ apply: true, actorUsername: `${tag}-actor`, outPath: join(outDir, 'hong.xlsx') }), { db, print, repoRoot, beforeStep })).rejects.toThrow('configuration step failed');
    expect(await db.userTeam.count({ where: { teamId: MOVE_SOURCE_TEAM_ID, userId: { in: [id['a-admin'], id['a-officer']] } } })).toBe(2);
    expect(await teamOf.petition('P1')).toBe(MOVE_SOURCE_TEAM_ID);
    expect(await db.teamRecordMove.count({ where: { sourceTeamId: MOVE_SOURCE_TEAM_ID } })).toBe(0);
    expect(await db.teamPermissionConfig.count({ where: { teamId: { in: chartTeamIds } } })).toBe(0);
    expect(existsSync(join(outDir, 'hong.xlsx'))).toBe(false);
  });

  let staleP1: Date;
  it('--that applies every step, and the oracle and the engine agree for every person', async () => {
    staleP1 = (await db.petition.findUnique({ where: { id: id.P1 } }))!.updatedAt;
    lines = [];
    const out = join(outDir, 'tai-khoan.xlsx');
    real = await runUnitChart(opts({ apply: true, outPath: out, actorUsername: `${tag}-actor` }), { db, print, repoRoot });
    expect(real.refused).toBeNull();
    expect(real.mismatches).toEqual([]);
    expect(real.moveId).toBeTruthy();
    expect(real.changeSetId).toBeTruthy();

    // 1. teams
    const created = await db.team.findMany({ where: { parentId: 'team_doi1_pc02' }, orderBy: { code: 'asc' }, select: { id: true, name: true, code: true, status: true } });
    expect(created).toEqual([1, 2, 3].map((n) => ({ id: `team_doi1_to${n}_pc02`, name: `Tổ ${n} – Đội 1`, code: `DOI1-TO${n}`, status: 'ACTIVE' })));
    // 3. configurations: one change set, with the reason; Đội 1 as today, the others team-only; the team under Đội 2
    // gets "as today" of its own (it had nothing, and follows nobody today).
    const set = await db.permissionChangeSet.findUnique({ where: { id: real.changeSetId! } });
    expect(set).toMatchObject({ kind: 'TEAM_CONFIG_APPLIED', reason: 'Sơ đồ PC02 26/11/2026', actorId: id.actor });
    expect((set!.changes as unknown[]).length).toBe(22);
    const configs = await db.teamPermissionConfig.findMany({ where: { teamId: { in: chartTeamIds } }, select: { teamId: true, mode: true, leaderTemplateId: true, memberTemplate: { select: { code: true } } } });
    expect(configs).toHaveLength(21);
    for (const c of configs) expect(c).toMatchObject({ mode: 'EXPLICIT', leaderTemplateId: null, memberTemplate: { code: c.teamId === 'team_doi1_pc02' ? 'STARTER_AS_TODAY' : 'STARTER_TEAM_ONLY' } });
    expect(await db.teamPermissionConfig.findUnique({ where: { teamId: `${tag}-sub2` }, select: { mode: true, memberTemplate: { select: { code: true } } } })).toEqual({
      mode: 'EXPLICIT', memberTemplate: { code: 'STARTER_AS_TODAY' },
    });
    const teamOnly = await db.permissionTemplate.findFirst({ where: { code: 'STARTER_TEAM_ONLY' }, include: { entries: { include: { permission: true } } } });
    expect(Object.fromEntries(teamOnly!.entries.map((e) => [`${e.permission.action}:${e.permission.subject}`, e.reach]))).toEqual({
      'read:Petition': 'TEAM_OWN', 'write:Petition': 'TEAM_OWN', 'edit:Petition': 'TEAM_OWN', 'read:Incident': 'TEAM_OWN', 'read:Case': 'TEAM_OWN', 'read:Directory': 'ALL',
    });
    // 4. the move: the people (leader flag kept), the live records; the deleted one and the team itself stay.
    expect(await db.userTeam.findMany({ where: { teamId: MOVE_TARGET_TEAM_ID, userId: { in: [id['a-admin'], id['a-officer']] } }, orderBy: { isLeader: 'desc' }, select: { userId: true, isLeader: true } })).toEqual([
      { userId: id['a-admin'], isLeader: true },
      { userId: id['a-officer'], isLeader: false },
    ]);
    expect(await teamOf.petition('P1')).toBe(MOVE_TARGET_TEAM_ID);
    expect(await teamOf.petition('P2')).toBe(MOVE_TARGET_TEAM_ID);
    expect(await teamOf.petition('P3')).toBe(MOVE_SOURCE_TEAM_ID);
    expect((await db.incident.findUnique({ where: { id: id.I1 } }))!.assignedTeamId).toBe(MOVE_TARGET_TEAM_ID);
    expect((await db.case.findUnique({ where: { id: id.C1 } }))!.assignedTeamId).toBe(MOVE_TARGET_TEAM_ID);
    expect(await teamOf.party('P1')).toBe(MOVE_TARGET_TEAM_ID);
    expect(await teamOf.party('P2')).toBe(MOVE_TARGET_TEAM_ID);
    // Pending hand-offs follow the people; a received one is history and stays.
    expect((await db.caseHandoff.findUnique({ where: { id: id.H1 } }))!.toTeamId).toBe(MOVE_TARGET_TEAM_ID);
    expect((await db.caseHandoff.findUnique({ where: { id: id.H2 } }))!.toTeamId).toBe(MOVE_SOURCE_TEAM_ID);
    expect((await db.incidentHandoff.findUnique({ where: { id: id.H3 } }))!.toTeamId).toBe(MOVE_TARGET_TEAM_ID);
    expect((await db.team.findUnique({ where: { id: MOVE_SOURCE_TEAM_ID } }))!.status).toBe('ACTIVE');
    expect(await db.teamRecordMove.findUnique({ where: { id: real.moveId! }, select: { status: true, reason: true } })).toEqual({ status: 'APPLIED', reason: 'Sơ đồ PC02 26/11/2026' });
    // 5. accounts: 42, in their units, heads as leaders, must change the password; the file holds working passwords.
    const accounts = await db.user.findMany({ where: { username: { in: accountNames } }, include: { userTeams: true, role: true } });
    expect(accounts).toHaveLength(42);
    for (const a of accounts) {
      const unit = CHART_UNITS.find((x) => a.username.startsWith(`${x.slug}.`) && a.username.slice(x.slug.length + 1).match(/^(truong|canbo)$/))!;
      expect(a.userTeams).toEqual([expect.objectContaining({ teamId: unit.teamId, isLeader: a.username.endsWith('.truong') })]);
      expect(a).toMatchObject({ mustChangePassword: true, twoFaSetupRequired: false, isActive: true, role: { name: 'OFFICER' } });
    }
    expect(await db.auditLog.count({ where: { action: 'USER_CREATED', userId: id.actor } })).toBe(42);
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(out);
    const rows = book.getWorksheet(1)!.getSheetValues().slice(2) as unknown as (string | undefined)[][];
    expect(rows).toHaveLength(42);
    const passwords = rows.map((r) => r[3] as string);
    expect(new Set(passwords).size).toBe(42);
    const doi2 = rows.find((r) => r[2] === 'doi2.truong')!;
    expect(doi2[1]).toBe('Đội 2');
    expect(await bcrypt.compare(doi2[3] as string, accounts.find((a) => a.username === 'doi2.truong')!.passwordHash)).toBe(true);
    // Never on the screen.
    for (const p of passwords) expect(lines.join('\n')).not.toContain(p);
  });

  it('a form opened before the move holds a stale stamp: its save is a conflict, not a silent move back', async () => {
    // The optimistic lock of the record services: update only where updatedAt is what the form read.
    const saved = await db.petition.updateMany({ where: { id: id.P1, updatedAt: staleP1 }, data: { assignedTeamId: MOVE_SOURCE_TEAM_ID } });
    expect(saved.count).toBe(0);
    expect(await teamOf.petition('P1')).toBe(MOVE_TARGET_TEAM_ID);
  });

  it('after the run, the stored state gives exactly the counts the dry run predicted (and the engine agrees)', () => {
    for (const p of real.people) expect({ who: p.username, after: p.after }).toEqual({ who: p.username, after: p.predicted });
    for (const p of real.people) expect({ who: p.username, engine: p.engine }).toEqual({ who: p.username, engine: p.after });
    expect(person(real, 'a-officer').after).toEqual({ petitions: 2, incidents: 2, cases: 1 });
    expect(person(real, 'to2.doi1.truong').after).toEqual({ petitions: 2, incidents: 1, cases: 1 });
  });

  it('running it again changes nothing and says so', async () => {
    const was = await footprint();
    lines = [];
    const again = await runUnitChart(opts({ apply: true, outPath: join(outDir, 'lan-hai.xlsx'), actorUsername: `${tag}-actor` }), { db, print, repoRoot });
    expect(again.refused).toBeNull();
    expect(again.plan!.move.status).toBe('DONE');
    expect(again.plan!.configs.every((c) => c.change === 'SAME')).toBe(true);
    expect(again.plan!.accountsToCreate).toEqual([]);
    expect(lines.join('\n')).toContain('Không còn việc gì');
    expect(await footprint()).toEqual(was);
    expect(existsSync(join(outDir, 'lan-hai.xlsx'))).toBe(false);
  });

  it('--hoan-tac puts people, records, steps and hand-offs back, except what changed since (and its steps), listed', async () => {
    await db.petition.update({ where: { id: id.P2 }, data: { senderName: 'P2' } }); // an edit: updatedAt moves
    lines = [];
    const undone = await runUnitChart(opts({ actorUsername: `${tag}-actor`, undoMoveId: real.moveId }), { db, print, repoRoot });
    expect(undone.refused).toBeNull();
    expect(undone.undo!.restored).toEqual({ user_teams: 2, petitions: 1, incidents: 1, cases: 1, proc_record_step_parties: 1, case_handoffs: 1, incident_handoffs: 1 });
    expect(undone.undo!.skipped).toEqual({ petitions: { count: 1, ids: [id.P2] }, proc_record_step_parties: { count: 1, ids: [`${tag}-party-P2`] } });
    expect(await db.userTeam.count({ where: { teamId: MOVE_SOURCE_TEAM_ID, userId: { in: [id['a-admin'], id['a-officer']] } } })).toBe(2);
    expect((await db.userTeam.findUnique({ where: { userId_teamId: { userId: id['a-admin'], teamId: MOVE_SOURCE_TEAM_ID } } }))!.isLeader).toBe(true);
    expect(await teamOf.petition('P1')).toBe(MOVE_SOURCE_TEAM_ID);
    expect(await teamOf.petition('P2')).toBe(MOVE_TARGET_TEAM_ID);
    // A step's unit goes back with its record, and only then.
    expect(await teamOf.party('P1')).toBe(MOVE_SOURCE_TEAM_ID);
    expect(await teamOf.party('P2')).toBe(MOVE_TARGET_TEAM_ID);
    expect((await db.incident.findUnique({ where: { id: id.I1 } }))!.assignedTeamId).toBe(MOVE_SOURCE_TEAM_ID);
    expect((await db.case.findUnique({ where: { id: id.C1 } }))!.assignedTeamId).toBe(MOVE_SOURCE_TEAM_ID);
    expect((await db.caseHandoff.findUnique({ where: { id: id.H1 } }))!.toTeamId).toBe(MOVE_SOURCE_TEAM_ID);
    expect((await db.incidentHandoff.findUnique({ where: { id: id.H3 } }))!.toTeamId).toBe(MOVE_SOURCE_TEAM_ID);
    expect(lines.join('\n')).toContain(`BỎ QUA 1 dòng petitions`);
    expect(await db.auditLog.count({ where: { action: 'TEAM_RECORDS_MOVE_UNDONE', userId: id.actor } })).toBe(1);
    // An undo is done once.
    await expect(runUnitChart(opts({ actorUsername: `${tag}-actor`, undoMoveId: real.moveId }), { db, print, repoRoot })).rejects.toMatchObject({
      response: { code: 'TEAM_MOVE_NOT_UNDOABLE' },
    });
  });
});
