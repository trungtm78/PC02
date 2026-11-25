/**
 * Applies the PC02 unit chart ("Sơ đồ cấu trúc user PC02.xlsx", 26/11/2026): a user of a team sees only the data of
 * their own team. See `pc02-unit-chart.ts` for what the chart says and `planChart` for how it is turned into steps.
 *
 * DRY RUN by default: it reads the database, prints every step it would take, the number of petitions, incidents and
 * cases each person concerned can read BEFORE and AFTER (counted by `reach-oracle.ts`, not by the permission engine),
 * and what else widens each person's reach (other teams, personal overrides, data access grants, the dispatcher flag).
 * It writes NOTHING.
 *
 * `--that` applies, in this order, each step only if it is still needed (a second run changes nothing and says so):
 *   1. creates "Tổ 1/2/3 – Đội 1" under Đội 1 (audit TEAM_CREATED);
 *   2. creates the starter templates that are missing, STARTER_TEAM_ONLY among them (history of "Phân quyền theo tổ");
 *   3. moves the people and the records of "Tổ công tác Số 2" to "Tổ 2 – Đội 1", in one transaction, every row logged
 *      (`--hoan-tac <id>` undoes it; the team itself stays as it is);
 *   4. gives the 21 units their configuration, in ONE change of the permission configuration (its history shows it;
 *      "Hoàn tác" there undoes it), reason "Sơ đồ PC02 26/11/2026";
 *   5. creates the default accounts that do not exist (an existing username is left alone, its password untouched).
 *      Their passwords go to the .xlsx of `--ra`, never to the screen, never into the repository.
 * and then counts again, with the oracle and with the engine, and says where the two differ.
 *
 * Changing the permission configuration needs no second administrator (only switching ENFORCE on does, and that is
 * not done here). The actor must be an active ADMIN account (`--nguoi-thuc-hien`): every change is recorded as theirs.
 *
 * On the server (after `set -a && . ./.env && set +a`, from /home/pc02/current/backend):
 *   node dist/src/authz/cli/ap-so-do-pc02.js                                                   # dry run
 *   node dist/src/authz/cli/ap-so-do-pc02.js --that --nguoi-thuc-hien <admin> --ra /home/pc02/so-do-pc02.xlsx
 *   node dist/src/authz/cli/ap-so-do-pc02.js --hoan-tac <moveId> --nguoi-thuc-hien <admin>
 * From the sources: `npm run authz:so-do-pc02 -- <the same arguments>`.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import { existsSync, realpathSync, rmSync, chmodSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { AuditService } from '../../audit/audit.service';
import { getBcryptCost } from '../../auth/utils/password-hash.util';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { preciseConditions } from '../../common/utils/precise-scope';
import { AuthzService } from '../authz.service';
import { AuthzAdminService } from '../admin/authz-admin.service';
import type { TeamDoc, WantedItem } from '../admin/documents';
import { STARTER_TEMPLATES, starterTemplates } from '../admin/starter-templates';
import { recordScope } from '../engine/scope';
import { memorablePasswords } from './memorable-password';
import {
  CHART_REASON,
  CHART_UNITS,
  MOVED_RECORD_TABLES,
  MOVE_SOURCE_TEAM_ID,
  MOVE_TARGET_TEAM_ID,
  chartTeamDoc,
  planChart,
  planHasWork,
  type ChartPlan,
  type ChartSnapshot,
  type PlannedAccount,
} from './pc02-unit-chart';
import { ORACLE_SUBJECTS, loadOracleState, readCounts, type OracleState, type OracleSubject } from './reach-oracle';
import { appliedMove, moveTeamPeopleAndRecords, undoTeamRecordMove } from './team-record-move';

export const REAL_RUN_FLAG = '--that';
const TX_OPTIONS = { timeout: 600_000, maxWait: 10_000 } as const;
const pair = (p: { action: string; subject: string }) => `${p.action}:${p.subject}`;

export interface RunOptions {
  apply: boolean;
  /** The .xlsx the passwords of new accounts are written to. Required by a real run that creates accounts. */
  outPath: string | null;
  actorUsername: string | null;
  undoMoveId: string | null;
}
export interface RunDeps {
  db: PrismaClient;
  print?: (line: string) => void;
  /** The checkout the CLI runs from: the passwords file is refused inside it. */
  repoRoot?: string;
  /** For tests: how passwords are made. */
  passwords?: (count: number) => string[];
}

type Counts = Record<OracleSubject, number>;
export interface PersonRow {
  userId: string;
  username: string;
  teams: string;
  /** A default account this run creates: it has no "before". */
  isNew: boolean;
  before: Counts | null;
  after: Counts | null;
  allBefore: string | null;
  allAfter: string | null;
  /** After a real run: what the dry run predicted (`after` is then counted on the stored state). */
  predicted?: Counts | null;
  /** After a real run: what the engine itself lets through. */
  engine?: Counts | null;
  widening: string[];
}
export interface RunResult {
  refused: string | null;
  plan: ChartPlan | null;
  people: PersonRow[];
  /** After a real run: people for whom the oracle and the engine disagree. */
  mismatches: PersonRow[];
  moveId: string | null;
  changeSetId: string | null;
  createdAccounts: string[];
  undo?: Awaited<ReturnType<typeof undoTeamRecordMove>>;
}

// ── reading the database ────────────────────────────────────────────────────────────────────────────────────────

export async function loadChartSnapshot(db: PrismaClient): Promise<ChartSnapshot> {
  const [teams, memberships, users, templates, configs, officer, move] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true, code: true, parentId: true, status: true, level: true, wardId: true } }),
    db.userTeam.findMany({ select: { userId: true, teamId: true, isLeader: true } }),
    db.user.findMany({ select: { id: true, username: true, isActive: true, workId: true, role: { select: { name: true } } } }),
    db.permissionTemplate.findMany({ where: { code: { in: STARTER_TEMPLATES.map((t) => t.code) } }, select: { id: true, code: true, status: true } }),
    db.teamPermissionConfig.findMany({ include: { overrides: { include: { permission: { select: { action: true, subject: true } } } } } }),
    db.role.findUnique({ where: { name: ROLE_NAMES.OFFICER }, select: { id: true } }),
    appliedMove(db, MOVE_SOURCE_TEAM_ID, MOVE_TARGET_TEAM_ID),
  ]);
  const onSource = async (table: string) =>
    Number((await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table}" WHERE "assignedTeamId" = $1 AND "deletedAt" IS NULL`, MOVE_SOURCE_TEAM_ID))[0].n);
  const deleted = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT (SELECT count(*) FROM petitions WHERE "assignedTeamId" = $1 AND "deletedAt" IS NOT NULL)
          + (SELECT count(*) FROM incidents WHERE "assignedTeamId" = $1 AND "deletedAt" IS NOT NULL)
          + (SELECT count(*) FROM cases WHERE "assignedTeamId" = $1 AND "deletedAt" IS NOT NULL) AS n`,
    MOVE_SOURCE_TEAM_ID,
  );
  const parties = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM proc_record_step_parties WHERE "teamId" = $1 AND "partyKind" = 'RECORD_TEAM'`,
    MOVE_SOURCE_TEAM_ID,
  );
  return {
    teams,
    memberships,
    users: users.map((u) => ({ id: u.id, username: u.username, roleName: u.role.name, isActive: u.isActive, workId: u.workId })),
    templates: new Map(templates.map((t) => [t.code, { id: t.id, status: t.status }])),
    teamConfigs: new Map(
      configs.map((c) => [
        c.teamId,
        {
          revision: c.revision,
          doc: {
            mode: c.mode,
            memberTemplateId: c.memberTemplateId,
            leaderTemplateId: c.leaderTemplateId,
            overrides: c.overrides.map((o) => ({
              permission: pair(o.permission),
              effect: o.effect,
              reach: o.reach,
              reason: o.reason,
              expiresAt: o.expiresAt?.toISOString() ?? null,
              audience: o.audience,
            })),
          } as TeamDoc,
        },
      ]),
    ),
    officerRoleId: officer?.id ?? null,
    appliedMove: move,
    onSource: {
      petitions: await onSource('petitions'),
      incidents: await onSource('incidents'),
      cases: await onSource('cases'),
      deleted: Number(deleted[0].n),
      stepParties: Number(parties[0].n),
    },
  };
}

async function officerPermissions(db: PrismaClient): Promise<string[]> {
  const role = await db.role.findUnique({
    where: { name: ROLE_NAMES.OFFICER },
    select: { permissions: { select: { permission: { select: { action: true, subject: true } } } } },
  });
  return role?.permissions.map((p) => pair(p.permission)) ?? [];
}

/** The state the oracle counts AFTER from, before anything is written: the plan laid over the state as it is. */
export function projectState(before: OracleState, plan: ChartPlan, officerPerms: readonly string[]): { state: OracleState; remap: { from: string; to: string } | null } {
  const docs = starterTemplates(officerPerms);
  const templates = new Map(before.templates);
  const templateIdOf = (code: 'STARTER_TEAM_ONLY' | 'STARTER_AS_TODAY', known: string | null) => {
    if (known) return known;
    templates.set(`new:${code}`, new Map(Object.entries(docs[code].entries)));
    return `new:${code}`;
  };
  const configs = new Map(before.configs);
  for (const c of plan.configs) {
    configs.set(c.teamId, { mode: 'EXPLICIT', memberTemplateId: templateIdOf(c.templateCode, c.templateId), leaderTemplateId: null, overrides: [] });
  }
  const teams = new Map(before.teams);
  for (const t of plan.teamsToCreate) teams.set(t.id, { name: t.name, parentId: t.parentId, active: true, wardId: null });
  const moving = plan.move.status === 'TODO';
  const memberships = before.memberships.map((m) => (moving && m.teamId === MOVE_SOURCE_TEAM_ID ? { ...m, teamId: MOVE_TARGET_TEAM_ID } : m));
  const users = new Map(before.users);
  const officer = new Set(officerPerms);
  for (const a of plan.accountsToCreate) {
    users.set(`new:${a.username}`, { username: a.username, roleName: ROLE_NAMES.OFFICER, rolePermissions: officer, canDispatch: false, isActive: true });
    memberships.push({ userId: `new:${a.username}`, teamId: a.unit.teamId, isLeader: a.isLeader });
  }
  return {
    state: { ...before, teams, memberships, users, configs, templates },
    remap: moving ? { from: MOVE_SOURCE_TEAM_ID, to: MOVE_TARGET_TEAM_ID } : null,
  };
}

/** Everybody the chart concerns: members (after) of the units and the teams that follow them, and the people moved. */
function peopleConcerned(after: OracleState, plan: ChartPlan): string[] {
  const teams = new Set([...CHART_UNITS.map((u) => u.teamId), ...plan.inheriting.map((t) => t.teamId)]);
  const moved = plan.move.status === 'TODO' ? plan.move.members.map((m) => m.userId) : [];
  const order = new Map(CHART_UNITS.map((u, i) => [u.teamId, i]));
  const rank = (userId: string) => Math.min(...after.memberships.filter((m) => m.userId === userId).map((m) => order.get(m.teamId) ?? 99), 99);
  const ids = new Set([...after.memberships.filter((m) => teams.has(m.teamId)).map((m) => m.userId), ...moved]);
  return [...ids].sort((a, b) => rank(a) - rank(b) || (after.users.get(a)?.username ?? a).localeCompare(after.users.get(b)?.username ?? b));
}

async function wideningOf(db: PrismaClient, state: OracleState, userId: string, unitTeams: ReadonlySet<string>): Promise<string[]> {
  if (userId.startsWith('new:')) return [];
  const out: string[] = [];
  const user = state.users.get(userId);
  if (user?.canDispatch) out.push('quyền điều phối (canDispatch): xem toàn bộ đơn thư, vụ việc, vụ án');
  const other = state.memberships.filter((m) => m.userId === userId && !unitTeams.has(m.teamId)).map((m) => state.teams.get(m.teamId)?.name ?? m.teamId);
  if (other.length) out.push(`còn thuộc tổ khác: ${other.join(', ')}`);
  const units = state.memberships.filter((m) => m.userId === userId && unitTeams.has(m.teamId));
  if (units.length > 1) out.push(`thuộc ${units.length} đơn vị trong sơ đồ: ${units.map((m) => state.teams.get(m.teamId)?.name ?? m.teamId).join(', ')}`);
  const overrides = await db.userPermissionOverride.findMany({ where: { userId }, include: { permission: { select: { action: true, subject: true } } } });
  for (const o of overrides) out.push(`ngoại lệ riêng: ${o.effect} ${pair(o.permission)}${o.reach ? ` (${o.reach})` : ''}${o.expiresAt ? ` đến ${o.expiresAt.toISOString().slice(0, 10)}` : ''}`);
  const grants = await db.dataAccessGrant.findMany({ where: { granteeId: userId }, select: { teamId: true, accessLevel: true, expiresAt: true } });
  for (const g of grants) out.push(`ủy quyền dữ liệu: ${g.accessLevel} tổ ${state.teams.get(g.teamId)?.name ?? g.teamId}${g.expiresAt ? ` đến ${g.expiresAt.toISOString().slice(0, 10)}` : ''}`);
  return out;
}

/** What the permission engine itself lets a person read, through the same conditions the list endpoints apply. */
async function engineCounts(db: PrismaClient, authz: AuthzService, userId: string): Promise<Counts | null> {
  const snapshot = await authz.snapshot();
  if (!snapshot.users.has(userId)) return null;
  const effective = await authz.effective(userId);
  const counts = {} as Counts;
  for (const s of ORACLE_SUBJECTS) {
    const table = MOVED_RECORD_TABLES.find((t) => t.table === s.key)!;
    const delegate = db[({ petitions: 'petition', incidents: 'incident', cases: 'case' } as const)[s.key]] as unknown as { count(args: unknown): Promise<number> };
    const scope = effective.canDispatch && !effective.admin ? ({ all: true } as const) : recordScope(snapshot.org, effective, s.permission, 'read');
    const conditions = scope.all ? null : preciseConditions(scope, userId, table.owner);
    counts[s.key] = conditions === null ? await delegate.count({ where: { deletedAt: null } }) : conditions.length === 0 ? 0 : await delegate.count({ where: { deletedAt: null, OR: conditions } });
  }
  return counts;
}

// ── printing ────────────────────────────────────────────────────────────────────────────────────────────────────

const fmt = (c: Counts | null, all: string | null, isNew = false) =>
  isNew ? 'mới' : !c ? 'khoá' : all ? `toàn bộ (${all === 'ADMIN' ? 'quản trị' : all === 'DISPATCH' ? 'điều phối' : 'ALL'}) ${c.petitions}/${c.incidents}/${c.cases}` : `${c.petitions}/${c.incidents}/${c.cases}`;

function printPlan(print: (l: string) => void, plan: ChartPlan) {
  print('── 1. Tổ mới dưới Đội 1');
  if (plan.teamsToCreate.length === 0) print('   (không tạo tổ nào)');
  for (const t of plan.teamsToCreate) print(`   + ${t.name}  [${t.id}, mã ${t.code}, cấp ${t.level}]`);
  print('── 2. Mẫu quyền khởi đầu');
  print(plan.startersMissing.length ? `   + tạo: ${plan.startersMissing.join(', ')} (và mọi mẫu khởi đầu khác còn thiếu)` : '   (đã có đủ)');
  print(`── 3. Chuyển người và hồ sơ: ${MOVE_SOURCE_TEAM_ID} → ${MOVE_TARGET_TEAM_ID}`);
  if (plan.move.status === 'DONE') {
    const l = plan.move.leftOnSource;
    print(`   đã chuyển (mã thao tác ${plan.move.moveId}, ${plan.move.movedAt.toISOString()}): không chuyển lại.`);
    print(`   trên tổ nguồn hiện có: ${l.petitions} đơn thư, ${l.incidents} vụ việc, ${l.cases} vụ án (giữ nguyên).`);
  } else if (plan.move.status === 'NOTHING') print('   (tổ nguồn không có người hay hồ sơ nào)');
  else {
    const r = plan.move.records;
    print(`   ${plan.move.members.length} thành viên (${plan.move.members.filter((m) => m.admin).length} quản trị, ${plan.move.members.filter((m) => m.isLeader).length} tổ trưởng): ${plan.move.members.map((m) => m.username).join(', ')}`);
    print(`   ${r.petitions} đơn thư, ${r.incidents} vụ việc, ${r.cases} vụ án; ${r.stepParties} đơn vị xử lý bước của hồ sơ. ${r.deleted} hồ sơ đã xoá không chuyển.`);
    print('   Tổ công tác Số 2 giữ nguyên (đang hoạt động, giữ thiết lập, hồ sơ phân công phường/xã, lịch, lịch sử).');
  }
  print('── 4. Phân quyền theo tổ (một lần lưu, lý do "' + CHART_REASON + '")');
  for (const c of plan.configs) {
    const what = c.change === 'SAME' ? 'giữ nguyên' : c.change === 'CREATE' ? 'đặt mới' : 'THAY thiết lập đang có';
    print(`   ${c.teamName.padEnd(26)} ${c.templateCode.padEnd(18)} ${what}`);
  }
  if (plan.inheriting.length) {
    print('   Các tổ sau không có thiết lập riêng nên sẽ theo đơn vị cấp trên:');
    for (const t of plan.inheriting) print(`     ${t.name} → theo ${t.governedBy}`);
  }
  print('── 5. Tài khoản mặc định (vai trò OFFICER, đổi mật khẩu khi đăng nhập lần đầu)');
  print(`   tạo ${plan.accountsToCreate.length}: ${plan.accountsToCreate.map((a) => a.username).join(', ') || '(không)'}`);
  if (plan.accountsExisting.length) {
    print(`   đã có (giữ nguyên, không đổi mật khẩu): ${plan.accountsExisting.map((a) => `${a.username}${a.inUnit ? '' : ' [KHÔNG thuộc đơn vị của nó]'}`).join(', ')}`);
  }
  print(`── Các tổ không có trong sơ đồ: giữ nguyên (${plan.untouched.length} tổ; ${plan.wardUnits} đơn vị phường/xã không liệt kê)`);
  for (const t of plan.untouched) print(`   ${t.name} [${t.id}]${t.ownConfig ? ' (có thiết lập riêng)' : ''}`);
}

function printPeople(print: (l: string) => void, people: PersonRow[], withEngine: boolean) {
  print('── Số hồ sơ mỗi người XEM được (đơn thư/vụ việc/vụ án), tính độc lập với bộ máy phân quyền');
  for (const p of people) {
    const engine = withEngine ? `   bộ máy: ${p.engine ? `${p.engine.petitions}/${p.engine.incidents}/${p.engine.cases}` : 'khoá'}` : '';
    print(`   ${p.username.padEnd(22)} ${p.teams.padEnd(28)} trước ${fmt(p.before, p.allBefore, p.isNew).padEnd(22)} sau ${fmt(p.after, p.allAfter)}${engine}`);
    for (const w of p.widening) print(`      · ${w}`);
  }
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The checkout this file runs from: the folder that holds `backend`. */
export function repoRootOf(from: string = __dirname): string {
  for (let dir = from; dirname(dir) !== dir; dir = dirname(dir)) if (basename(dir) === 'backend') return dirname(dir);
  return from;
}

function inside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Why the passwords file cannot be written there, or null. */
export function outPathProblem(outPath: string, repoRoot: string): string | null {
  const target = resolve(outPath);
  if (!target.toLowerCase().endsWith('.xlsx')) return 'Tệp --ra phải là .xlsx.';
  if (existsSync(target)) return `Tệp ${target} đã có: không ghi đè.`;
  if (!existsSync(dirname(target))) return `Thư mục ${dirname(target)} không có.`;
  const real = join(realpathSync(dirname(target)), basename(target));
  const root = existsSync(repoRoot) ? realpathSync(repoRoot) : resolve(repoRoot);
  if (inside(real, root) || inside(target, resolve(repoRoot))) return `Tệp mật khẩu không được nằm trong kho mã (${root}).`;
  return null;
}

async function writePasswords(path: string, rows: { unit: string; username: string; password: string; role: string }[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Tài khoản');
  sheet.columns = [
    { header: 'Đơn vị', key: 'unit', width: 26 },
    { header: 'Tên đăng nhập', key: 'username', width: 22 },
    { header: 'Mật khẩu', key: 'password', width: 22 },
    { header: 'Vai trò trong đơn vị', key: 'role', width: 22 },
  ];
  for (const r of rows) sheet.addRow(r);
  sheet.getRow(1).font = { bold: true };
  await book.xlsx.writeFile(path);
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows: no POSIX modes.
  }
}

export async function runUnitChart(options: RunOptions, deps: RunDeps): Promise<RunResult> {
  const { db } = deps;
  const print = deps.print ?? ((l: string) => console.log(l));
  const result: RunResult = { refused: null, plan: null, people: [], mismatches: [], moveId: null, changeSetId: null, createdAccounts: [] };
  const refuse = (why: string) => {
    print(`DỪNG: ${why}`);
    return { ...result, refused: why };
  };
  const audit = new AuditService(db as never);

  const actor = options.actorUsername
    ? await db.user.findUnique({ where: { username: options.actorUsername }, select: { id: true, isActive: true, role: { select: { name: true } } } })
    : null;
  const needActor = options.apply || options.undoMoveId !== null;
  if (needActor) {
    if (!options.actorUsername) return refuse('cần --nguoi-thuc-hien <tên đăng nhập của một quản trị viên>.');
    if (!actor || !actor.isActive || actor.role.name !== ROLE_NAMES.ADMIN) return refuse(`"${options.actorUsername}" không phải tài khoản quản trị đang hoạt động.`);
  }

  // ── undo of the move ──
  if (options.undoMoveId) {
    print(`=== Hoàn tác chuyển tổ ${options.undoMoveId} ===`);
    const undo = await undoTeamRecordMove(db, options.undoMoveId, actor!.id);
    await audit.log({
      userId: actor!.id,
      action: 'TEAM_RECORDS_MOVE_UNDONE',
      subject: 'Team',
      subjectId: undo.sourceTeamId,
      metadata: { moveId: options.undoMoveId, targetTeamId: undo.targetTeamId, restored: undo.restored, skipped: Object.fromEntries(Object.entries(undo.skipped).map(([k, v]) => [k, v.count])) },
    });
    print(`Đã trả lại: ${Object.entries(undo.restored).map(([k, n]) => `${k} ${n}`).join(', ')}`);
    if (Object.keys(undo.skipped).length === 0) print('Không có dòng nào bị bỏ qua.');
    for (const [table, s] of Object.entries(undo.skipped)) print(`BỎ QUA ${s.count} dòng ${table} (đã thay đổi sau khi chuyển): ${s.ids.join(', ')}${s.count > s.ids.length ? ', …' : ''}`);
    print('Phân quyền của các tổ và tài khoản mặc định KHÔNG hoàn tác ở đây: dùng tab Lịch sử của màn Phân quyền theo tổ, và màn Quản lý người dùng.');
    return { ...result, undo };
  }

  print(`=== Áp sơ đồ PC02 — ${options.apply ? 'GHI THẬT' : 'CHẠY THỬ (không ghi gì)'} ===`);
  const authz = new AuthzService(db as never);
  const mode = await authz.mode();
  if (mode !== 'ENFORCE') print(`LƯU Ý: chế độ phân quyền theo tổ đang là ${mode}: cấu hình chỉ có hiệu lực khi ở ENFORCE.`);

  const snapshot = await loadChartSnapshot(db);
  const plan = planChart(snapshot);
  result.plan = plan;
  printPlan(print, plan);

  const officerPerms = await officerPermissions(db);
  const before = await loadOracleState(db);
  const { state: after, remap } = projectState(before, plan, officerPerms);
  const unitTeams = new Set([...CHART_UNITS.map((u) => u.teamId), ...plan.inheriting.map((t) => t.teamId)]);
  const teamsOf = (state: OracleState, userId: string) =>
    state.memberships.filter((m) => m.userId === userId).map((m) => `${state.teams.get(m.teamId)?.name ?? m.teamId}${m.isLeader ? '*' : ''}`).join(', ');
  for (const userId of peopleConcerned(after, plan)) {
    const b = userId.startsWith('new:') ? null : await readCounts(db, before, userId, null);
    const a = await readCounts(db, after, userId, remap);
    result.people.push({
      userId,
      username: after.users.get(userId)?.username ?? userId,
      teams: teamsOf(after, userId),
      isNew: userId.startsWith('new:'),
      before: b?.counts ?? null,
      after: a?.counts ?? null,
      allBefore: b?.all ?? null,
      allAfter: a?.all ?? null,
      widening: await wideningOf(db, after, userId, unitTeams),
    });
  }
  printPeople(print, result.people, false);
  print('   (* = tổ trưởng; "khoá" = tài khoản không đăng nhập được; "mới" = tài khoản mặc định lần chạy này tạo)');

  if (plan.blockers.length) {
    for (const b of plan.blockers) print(`VƯỚNG: ${b}`);
  }
  if (!options.apply) {
    print(planHasWork(plan) ? 'CHẠY THỬ: chưa ghi gì. Thêm --that để thực hiện.' : 'Không còn việc gì: cơ sở dữ liệu đã đúng sơ đồ.');
    return result;
  }
  if (plan.blockers.length) return refuse('còn vướng (liệt kê ở trên); không ghi gì.');
  if (!planHasWork(plan)) {
    print('Không còn việc gì: cơ sở dữ liệu đã đúng sơ đồ. Không ghi gì.');
    return result;
  }
  if (plan.accountsToCreate.length > 0) {
    if (!options.outPath) return refuse('có tài khoản cần tạo: cần --ra <đường dẫn tệp .xlsx ngoài kho mã> để ghi mật khẩu.');
    const problem = outPathProblem(options.outPath, deps.repoRoot ?? repoRootOf());
    if (problem) return refuse(problem);
  }
  const actorId = actor!.id;
  const admin = new AuthzAdminService(db as never, authz, audit);

  // 1. teams
  if (plan.teamsToCreate.length) {
    await db.$transaction(async (tx) => {
      for (const [i, t] of plan.teamsToCreate.entries()) {
        await tx.team.create({ data: { id: t.id, name: t.name, code: t.code, level: t.level, parentId: t.parentId, order: i + 1 } });
        await audit.log({ userId: actorId, action: 'TEAM_CREATED', subject: 'Team', subjectId: t.id, metadata: { name: t.name, code: t.code, reason: CHART_REASON } }, tx);
      }
    });
    print(`ĐÃ TẠO ${plan.teamsToCreate.length} tổ.`);
  }

  // 2. starter templates
  if (plan.startersMissing.length) {
    const made = await admin.createStarterTemplates(actorId, undefined, CHART_REASON);
    print(`ĐÃ TẠO mẫu: ${made.created.map((c) => c.code).join(', ')} (thay đổi ${made.changeSetId}).`);
  }
  const templateIds = new Map(
    (await db.permissionTemplate.findMany({ where: { code: { in: ['STARTER_TEAM_ONLY', 'STARTER_AS_TODAY'] } }, select: { id: true, code: true } })).map((t) => [t.code, t.id]),
  );

  // 3. the move
  if (plan.move.status === 'TODO') {
    const moved = await db.$transaction(async (tx) => {
      const m = await moveTeamPeopleAndRecords(tx, { sourceTeamId: MOVE_SOURCE_TEAM_ID, targetTeamId: MOVE_TARGET_TEAM_ID, reason: CHART_REASON, actorId });
      await audit.log(
        { userId: actorId, action: 'TEAM_RECORDS_MOVED', subject: 'Team', subjectId: MOVE_SOURCE_TEAM_ID, metadata: { moveId: m.moveId, targetTeamId: MOVE_TARGET_TEAM_ID, moved: m.summary.moved, reason: CHART_REASON } },
        tx,
      );
      return m;
    }, TX_OPTIONS);
    result.moveId = moved.moveId;
    print(`ĐÃ CHUYỂN: ${Object.entries(moved.summary.moved).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(', ')}. Mã thao tác (để hoàn tác): ${moved.moveId}`);
  }

  // 4. configurations, in one change
  const wanted: WantedItem[] = [];
  for (const c of plan.configs.filter((x) => x.change !== 'SAME')) {
    const templateId = templateIds.get(c.templateCode);
    if (!templateId) return refuse(`không thấy mẫu ${c.templateCode} sau bước 2.`);
    wanted.push({ type: 'team', id: c.teamId, after: chartTeamDoc(templateId) });
  }
  if (wanted.length) {
    const committed = await admin.commit(actorId, 'TEAM_CONFIG_APPLIED', wanted, {
      reason: CHART_REASON,
      expected: Object.fromEntries(plan.configs.filter((c) => wanted.some((w) => w.id === c.teamId)).map((c) => [`team:${c.teamId}`, c.revision])),
    });
    result.changeSetId = committed.changeSetId;
    print(`ĐÃ LƯU phân quyền của ${committed.items.length} tổ (thay đổi ${committed.changeSetId}: hoàn tác ở tab Lịch sử).`);
  }

  // 5. accounts
  if (plan.accountsToCreate.length) {
    const passwords = (deps.passwords ?? memorablePasswords)(plan.accountsToCreate.length);
    const hashes = await Promise.all(passwords.map((p) => bcrypt.hash(p, getBcryptCost())));
    const outPath = resolve(options.outPath!);
    await writePasswords(
      outPath,
      plan.accountsToCreate.map((a: PlannedAccount, i) => ({ unit: a.unit.label, username: a.username, password: passwords[i], role: a.isLeader ? 'Trưởng (tổ trưởng)' : 'Cán bộ' })),
    );
    try {
      await db.$transaction(async (tx) => {
        for (const [i, a] of plan.accountsToCreate.entries()) await createAccount(tx, audit, actorId, snapshot.officerRoleId!, a, hashes[i]);
      }, TX_OPTIONS);
    } catch (err) {
      // Nothing was created: a file of passwords for accounts that do not exist must not be left behind.
      rmSync(outPath, { force: true });
      throw err;
    }
    result.createdAccounts = plan.accountsToCreate.map((a) => a.username);
    print(`ĐÃ TẠO ${plan.accountsToCreate.length} tài khoản. Mật khẩu ở ${outPath} (không in ra màn hình).`);
  }

  // Counted again: the oracle on what is now stored, and the engine itself.
  await authz.refresh();
  const now = await loadOracleState(db);
  const ids = new Map([...now.users].map(([id, u]) => [u.username, id]));
  for (const p of result.people) {
    const userId = p.userId.startsWith('new:') ? ids.get(p.username) : p.userId;
    if (!userId) continue;
    const counted = await readCounts(db, now, userId, null);
    p.userId = userId;
    p.predicted = p.after;
    p.after = counted?.counts ?? null;
    p.allAfter = counted?.all ?? null;
    p.engine = await engineCounts(db, authz, userId);
    const same = JSON.stringify(p.engine) === JSON.stringify(p.after);
    if (!same) result.mismatches.push(p);
  }
  printPeople(print, result.people, true);
  if (result.mismatches.length) {
    print(`KHÁC NHAU giữa phép đếm độc lập và bộ máy phân quyền ở ${result.mismatches.length} người: ${result.mismatches.map((p) => p.username).join(', ')}. Kiểm tra trước khi dùng.`);
  } else print('Phép đếm độc lập và bộ máy phân quyền khớp nhau ở mọi người.');
  const drift = result.people.filter((p) => JSON.stringify(p.predicted) !== JSON.stringify(p.after));
  if (drift.length) print(`Khác dự kiến của bản chạy thử (dữ liệu đã đổi trong lúc chạy?): ${drift.map((p) => p.username).join(', ')}`);
  return result;
}

async function createAccount(tx: Prisma.TransactionClient, audit: AuditService, actorId: string, roleId: string, a: PlannedAccount, passwordHash: string) {
  const user = await tx.user.create({
    data: {
      username: a.username,
      firstName: a.firstName,
      lastName: a.lastName,
      workId: a.workId,
      passwordHash,
      roleId,
      isActive: true,
      mustChangePassword: true,
      // Every officer account in use has this off; an account made with it on cannot sign in (25/08/2026).
      twoFaSetupRequired: false,
    },
    select: { id: true },
  });
  await tx.userTeam.create({ data: { userId: user.id, teamId: a.unit.teamId, isLeader: a.isLeader } });
  await audit.log(
    {
      userId: actorId,
      action: 'USER_CREATED',
      subject: 'User',
      subjectId: user.id,
      metadata: { createdUsername: a.username, teamId: a.unit.teamId, isLeader: a.isLeader, source: 'ap-so-do-pc02', reason: CHART_REASON },
    },
    tx,
  );
}

function argOf(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

export function parseArgs(argv: readonly string[]): RunOptions {
  return {
    apply: argv.includes(REAL_RUN_FLAG),
    outPath: argOf(argv, '--ra'),
    actorUsername: argOf(argv, '--nguoi-thuc-hien'),
    undoMoveId: argOf(argv, '--hoan-tac'),
  };
}

async function main(): Promise<void> {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    const result = await runUnitChart(parseArgs(process.argv.slice(2)), { db });
    if (result.refused || result.mismatches.length) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
