import type { TeamDoc } from '../admin/documents';

/**
 * The PC02 unit chart ("Sơ đồ cấu trúc user PC02.xlsx", decisions of 26/11/2026) as data, and the plan that turns the
 * database as it is into the database as the chart wants it. PURE: everything here works on a snapshot read
 * beforehand, so the plan can be shown before anything is written and tested without a database.
 *
 *   - three teams under Đội 1: "Tổ 1/2/3 – Đội 1";
 *   - the people and the records of "Tổ công tác Số 2" go to "Tổ 2 – Đội 1" (the accounts in use today all belong
 *     to Tổ 2 Đội 1); the team itself stays as it is;
 *   - each unit sees only its own team (template STARTER_TEAM_ONLY, reach TEAM_OWN); Đội 1 sees itself, its three
 *     teams and the unassigned records, as today (STARTER_AS_TODAY);
 *   - two default accounts per unit: the head (`<unit>.truong`, leader of the team) and an officer (`<unit>.canbo`).
 */

/** What the history of the permission screen and the audit say these changes were for. */
export const CHART_REASON = 'Sơ đồ PC02 26/11/2026';

export const DOI1_TEAM_ID = 'team_doi1_pc02';
/** "Tổ công tác Số 2": its people and records move to "Tổ 2 – Đội 1". */
export const MOVE_SOURCE_TEAM_ID = 'team_ct02_pc02';
export const MOVE_TARGET_TEAM_ID = 'team_doi1_to2_pc02';

export type ChartTemplate = 'STARTER_TEAM_ONLY' | 'STARTER_AS_TODAY';

export interface ChartUnit {
  /** The first part of the default usernames: `<slug>.truong`, `<slug>.canbo`. */
  slug: string;
  teamId: string;
  /** How the unit is named on the chart (and in the names of its default accounts). */
  label: string;
  /** Present for a team the chart adds: it is created under its parent. */
  create?: { code: string; name: string; parentId: string };
  template: ChartTemplate;
}

const newTeam = (n: number): ChartUnit => ({
  slug: `to${n}.doi1`,
  teamId: `team_doi1_to${n}_pc02`,
  label: `Tổ ${n} – Đội 1`,
  create: { code: `DOI1-TO${n}`, name: `Tổ ${n} – Đội 1`, parentId: DOI1_TEAM_ID },
  template: 'STARTER_TEAM_ONLY',
});

/** The 21 units of the chart, in the order of the chart. */
export const CHART_UNITS: readonly ChartUnit[] = [
  { slug: 'doi1', teamId: DOI1_TEAM_ID, label: 'Đội 1', template: 'STARTER_AS_TODAY' },
  newTeam(1),
  newTeam(2),
  newTeam(3),
  ...[2, 3, 4, 5, 6].map((n): ChartUnit => ({ slug: `doi${n}`, teamId: `team_doi${n}_pc02`, label: `Đội ${n}`, template: 'STARTER_TEAM_ONLY' })),
  ...Array.from({ length: 10 }, (_, i): ChartUnit => ({
    slug: `tct${i + 1}`,
    teamId: `team_ct${String(i + 1).padStart(2, '0')}_pc02`,
    label: `Tổ công tác Số ${i + 1}`,
    template: 'STARTER_TEAM_ONLY',
  })),
  { slug: 'cs1', teamId: 'team_cs1_pc02', label: 'Cơ sở 1', template: 'STARTER_TEAM_ONLY' },
  { slug: 'cs2', teamId: 'team_cs2_pc02', label: 'Cơ sở 2', template: 'STARTER_TEAM_ONLY' },
];

/** The two default accounts of a unit. */
export const ACCOUNT_KINDS = [
  { suffix: 'truong', title: 'Trưởng', isLeader: true, workIdNo: '01' },
  { suffix: 'canbo', title: 'Cán bộ', isLeader: false, workIdNo: '02' },
] as const;

/** Ids of the records-holding tables the move touches, with the column that names the owner of a record. */
export const MOVED_RECORD_TABLES = [
  { table: 'petitions', kind: 'PETITION', owner: 'enteredById' },
  { table: 'incidents', kind: 'INCIDENT', owner: 'investigatorId' },
  { table: 'cases', kind: 'CASE', owner: 'investigatorId' },
] as const;

// ── the snapshot the plan is made from ──────────────────────────────────────────────────────────────────────────

export interface SnapshotTeam {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  level: number;
  wardId: string | null;
}
export interface SnapshotUser {
  id: string;
  username: string;
  roleName: string;
  isActive: boolean;
  workId: string | null;
}
export interface ChartSnapshot {
  teams: readonly SnapshotTeam[];
  memberships: readonly { userId: string; teamId: string; isLeader: boolean }[];
  users: readonly SnapshotUser[];
  /** Starter templates by code (any status). */
  templates: ReadonlyMap<string, { id: string; status: 'ACTIVE' | 'ARCHIVED' }>;
  /** Every team's own configuration, with the revision it was read at. */
  teamConfigs: ReadonlyMap<string, { doc: TeamDoc; revision: number }>;
  officerRoleId: string | null;
  /** A move of the source to the target that is in effect (not undone). */
  appliedMove: { id: string; movedAt: Date } | null;
  /** What sits on the source team now. */
  onSource: { petitions: number; incidents: number; cases: number; deleted: number; stepParties: number; pendingHandoffs: number };
}

// ── the plan ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PlannedAccount {
  unit: ChartUnit;
  username: string;
  firstName: string;
  lastName: string;
  isLeader: boolean;
  workId: string;
}

export interface PlannedConfig {
  teamId: string;
  teamName: string;
  /**
   * UNIT: a unit of the chart. KEEP_CHILD: a team under a unit, with no configuration of its own, given one equal to
   * what it follows today so that the unit's new configuration does not reach it (`--giu-cau-hinh-to-con`).
   */
  kind: 'UNIT' | 'KEEP_CHILD';
  templateCode: ChartTemplate;
  /** The template's id, or null when it is created by this run. */
  templateId: string | null;
  /** KEEP_CHILD under a configured ancestor: that ancestor's configuration, copied (else the template above). */
  copied: TeamDoc | null;
  before: TeamDoc | null;
  revision: number;
  change: 'CREATE' | 'REPLACE' | 'SAME';
}

export interface PlanOptions {
  /** `--giu-cau-hinh-to-con`: keep what the teams under a unit have today instead of refusing. */
  keepChildren?: boolean;
}

export interface ChartPlan {
  /** Anything here stops a real run before it writes anything. */
  blockers: string[];
  teamsToCreate: { id: string; code: string; name: string; parentId: string; level: number }[];
  startersMissing: ChartTemplate[];
  move:
    | { status: 'TODO'; members: { userId: string; username: string; isLeader: boolean; admin: boolean }[]; records: ChartSnapshot['onSource'] }
    | { status: 'DONE'; moveId: string; movedAt: Date; leftOnSource: ChartSnapshot['onSource'] }
    | { status: 'NOTHING' };
  configs: PlannedConfig[];
  /** Teams with no configuration of their own that will follow a configured unit (they are under it). */
  inheriting: { teamId: string; name: string; governedBy: string }[];
  accountsToCreate: PlannedAccount[];
  accountsExisting: { username: string; inUnit: boolean }[];
  /** Teams the chart does not name and that do not follow a unit of it: left exactly as they are. */
  untouched: { id: string; name: string; ownConfig: boolean }[];
  /** Ward units (left as they are), counted only. */
  wardUnits: number;
}

export const accountUsername = (unit: ChartUnit, suffix: string) => `${unit.slug}.${suffix}`;
export const accountWorkId = (unit: ChartUnit, no: string) => `MD-${unit.slug.replace(/\./g, '').toUpperCase()}-${no}`;

/** The configuration the chart gives a unit: its own, the template for members and for leaders alike, no overrides. */
export const chartTeamDoc = (templateId: string): TeamDoc => ({ mode: 'EXPLICIT', memberTemplateId: templateId, leaderTemplateId: null, overrides: [] });

const sameConfig = (a: TeamDoc | null, b: TeamDoc): boolean =>
  !!a && a.mode === b.mode && a.memberTemplateId === b.memberTemplateId && a.leaderTemplateId === b.leaderTemplateId && a.overrides.length === 0;

export const KEEP_CHILDREN_FLAG = '--giu-cau-hinh-to-con';

export function planChart(snapshot: ChartSnapshot, options: PlanOptions = {}): ChartPlan {
  const blockers: string[] = [];
  const teamById = new Map(snapshot.teams.map((t) => [t.id, t]));
  const userById = new Map(snapshot.users.map((u) => [u.id, u]));

  // 1. teams
  const teamsToCreate: ChartPlan['teamsToCreate'] = [];
  for (const unit of CHART_UNITS) {
    const team = teamById.get(unit.teamId);
    if (team) {
      if (team.status !== 'ACTIVE') blockers.push(`Tổ "${team.name}" (${team.id}) đang ở trạng thái ${team.status}: sơ đồ cần tổ đang hoạt động.`);
      continue;
    }
    if (!unit.create) {
      blockers.push(`Không thấy tổ ${unit.teamId} (${unit.label}) trong cơ sở dữ liệu.`);
      continue;
    }
    const parent = teamById.get(unit.create.parentId);
    if (!parent) continue; // reported for Đội 1 above
    const nameTaken = snapshot.teams.find((t) => t.name === unit.create!.name);
    const codeTaken = snapshot.teams.find((t) => t.code === unit.create!.code);
    if (nameTaken) blockers.push(`Tên "${unit.create.name}" đã thuộc tổ khác (${nameTaken.id}).`);
    if (codeTaken) blockers.push(`Mã "${unit.create.code}" đã thuộc tổ khác (${codeTaken.id}).`);
    teamsToCreate.push({ id: unit.teamId, code: unit.create.code, name: unit.create.name, parentId: parent.id, level: parent.level + 1 });
  }
  if (!teamById.get(MOVE_SOURCE_TEAM_ID)) blockers.push(`Không thấy tổ nguồn ${MOVE_SOURCE_TEAM_ID}.`);

  // 2. starter templates
  const startersMissing = (['STARTER_AS_TODAY', 'STARTER_TEAM_ONLY'] as const).filter((code) => !snapshot.templates.has(code));
  for (const code of ['STARTER_AS_TODAY', 'STARTER_TEAM_ONLY'] as const) {
    if (snapshot.templates.get(code)?.status === 'ARCHIVED') blockers.push(`Mẫu ${code} đang lưu trữ: khôi phục nó trước (màn Phân quyền theo tổ).`);
  }
  if (!snapshot.officerRoleId) blockers.push('Không thấy vai trò OFFICER.');

  // 3. the move
  let move: ChartPlan['move'];
  if (snapshot.appliedMove) {
    move = { status: 'DONE', moveId: snapshot.appliedMove.id, movedAt: snapshot.appliedMove.movedAt, leftOnSource: snapshot.onSource };
  } else {
    const members = snapshot.memberships
      .filter((m) => m.teamId === MOVE_SOURCE_TEAM_ID)
      .map((m) => {
        const u = userById.get(m.userId);
        return { userId: m.userId, username: u?.username ?? m.userId, isLeader: m.isLeader, admin: u?.roleName === 'ADMIN' };
      })
      .sort((a, b) => a.username.localeCompare(b.username));
    const r = snapshot.onSource;
    const anything = members.length + r.petitions + r.incidents + r.cases + r.stepParties + r.pendingHandoffs > 0;
    move = anything ? { status: 'TODO', members, records: r } : { status: 'NOTHING' };
    const already = snapshot.memberships.filter((m) => m.teamId === MOVE_TARGET_TEAM_ID && members.some((x) => x.userId === m.userId));
    for (const m of already) blockers.push(`${userById.get(m.userId)?.username ?? m.userId} đã là thành viên của tổ đích: không chuyển được hai lần.`);
  }

  // 4. configurations
  const configs: PlannedConfig[] = CHART_UNITS.map((unit) => {
    const templateId = snapshot.templates.get(unit.template)?.id ?? null;
    const current = snapshot.teamConfigs.get(unit.teamId) ?? null;
    const before = current?.doc ?? null;
    const change: PlannedConfig['change'] = templateId && sameConfig(before, chartTeamDoc(templateId)) ? 'SAME' : before ? 'REPLACE' : 'CREATE';
    return {
      kind: 'UNIT' as const,
      teamId: unit.teamId,
      teamName: teamById.get(unit.teamId)?.name ?? unit.create?.name ?? unit.label,
      templateCode: unit.template,
      templateId,
      copied: null,
      before,
      revision: current?.revision ?? 0,
      change,
    };
  });

  // Teams under a unit that have no configuration of their own would follow that unit's configuration from now on
  // (a configuration governs the teams below it). That silently changes what their people may do, so it is refused,
  // or (`keepChildren`) each gets a configuration of its own equal to what it follows today.
  const configured = new Set(CHART_UNITS.map((u) => u.teamId));
  const explicitToday = (id: string) => snapshot.teamConfigs.get(id)?.doc.mode === 'EXPLICIT';
  const explicit = (id: string) => configured.has(id) || explicitToday(id);
  const inheriting: ChartPlan['inheriting'] = [];
  for (const team of snapshot.teams) {
    if (team.status === 'ARCHIVED' || explicit(team.id)) continue;
    const seen = new Set<string>();
    for (let id = team.parentId; id && !seen.has(id); id = teamById.get(id)?.parentId ?? null) {
      seen.add(id);
      if (!explicit(id)) continue;
      if (configured.has(id)) inheriting.push({ teamId: team.id, name: team.name, governedBy: teamById.get(id)?.name ?? id });
      break;
    }
  }
  const activeInheriting = inheriting.filter((t) => teamById.get(t.teamId)?.status === 'ACTIVE');
  if (activeInheriting.length && !options.keepChildren) {
    blockers.push(
      `${activeInheriting.length} tổ dưới các đơn vị của sơ đồ không có thiết lập riêng và sẽ theo phân quyền mới của đơn vị cấp trên: ` +
        `${activeInheriting.map((t) => `${t.name} (theo ${t.governedBy})`).join('; ')}. ` +
        `Đặt thiết lập riêng cho các tổ ấy trước, hoặc chạy với ${KEEP_CHILDREN_FLAG} để giữ nguyên quyền hiện nay của chúng.`,
    );
  }
  if (options.keepChildren) {
    for (const child of inheriting) {
      // What the team follows TODAY: the nearest configuration up its line, or nobody's (the role, "as today").
      let today: TeamDoc | null = null;
      const seen = new Set<string>();
      for (let id = teamById.get(child.teamId)?.parentId ?? null; id && !seen.has(id); id = teamById.get(id)?.parentId ?? null) {
        seen.add(id);
        if (explicitToday(id)) {
          today = snapshot.teamConfigs.get(id)!.doc;
          break;
        }
      }
      if (!today) {
        // "As today" equals what the role holds only for officers (an administrator is never limited by a team).
        const others = snapshot.memberships
          .filter((m) => m.teamId === child.teamId)
          .map((m) => userById.get(m.userId))
          .filter((u) => u && u.roleName !== 'OFFICER' && u.roleName !== 'ADMIN');
        if (others.length) {
          blockers.push(`Tổ ${child.name}: ${others.map((u) => `${u!.username} (${u!.roleName})`).join(', ')} không phải cán bộ: mẫu "như hiện nay" không giữ nguyên được quyền của họ.`);
        }
      }
      const current = snapshot.teamConfigs.get(child.teamId) ?? null;
      configs.push({
        kind: 'KEEP_CHILD',
        teamId: child.teamId,
        teamName: child.name,
        templateCode: 'STARTER_AS_TODAY',
        templateId: today ? null : (snapshot.templates.get('STARTER_AS_TODAY')?.id ?? null),
        copied: today,
        before: current?.doc ?? null,
        revision: current?.revision ?? 0,
        change: current ? 'REPLACE' : 'CREATE',
      });
    }
  }

  // 5. accounts
  const byUsername = new Map(snapshot.users.map((u) => [u.username, u]));
  const workIds = new Map(snapshot.users.filter((u) => u.workId).map((u) => [u.workId as string, u.username]));
  const accountsToCreate: PlannedAccount[] = [];
  const accountsExisting: ChartPlan['accountsExisting'] = [];
  for (const unit of CHART_UNITS) {
    for (const kind of ACCOUNT_KINDS) {
      const username = accountUsername(unit, kind.suffix);
      const existing = byUsername.get(username);
      if (existing) {
        accountsExisting.push({ username, inUnit: snapshot.memberships.some((m) => m.userId === existing.id && m.teamId === unit.teamId) });
        continue;
      }
      const workId = accountWorkId(unit, kind.workIdNo);
      if (workIds.has(workId)) blockers.push(`Mã cán bộ ${workId} đã thuộc tài khoản ${workIds.get(workId)}.`);
      accountsToCreate.push({ unit, username, lastName: kind.title, firstName: unit.label, isLeader: kind.isLeader, workId });
    }
  }

  const following = new Set(inheriting.map((t) => t.teamId));
  const untouched = snapshot.teams
    .filter((t) => t.status !== 'ARCHIVED' && t.wardId === null && !configured.has(t.id) && !following.has(t.id))
    .map((t) => ({ id: t.id, name: t.name, ownConfig: snapshot.teamConfigs.has(t.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const wardUnits = snapshot.teams.filter((t) => t.status !== 'ARCHIVED' && t.wardId !== null).length;

  return { blockers, teamsToCreate, startersMissing, move, configs, inheriting, accountsToCreate, accountsExisting, untouched, wardUnits };
}

/** Whether a real run would change anything at all. */
export function planHasWork(plan: ChartPlan): boolean {
  return (
    plan.teamsToCreate.length > 0 ||
    plan.startersMissing.length > 0 ||
    plan.move.status === 'TODO' ||
    plan.configs.some((c) => c.change !== 'SAME') ||
    plan.accountsToCreate.length > 0
  );
}
