import { usernameProblems } from '../../common/validators/username.rule';
import {
  CHART_UNITS,
  DOI1_TEAM_ID,
  MOVE_SOURCE_TEAM_ID,
  MOVE_TARGET_TEAM_ID,
  chartTeamDoc,
  planChart,
  planHasWork,
  type ChartSnapshot,
  type SnapshotTeam,
} from './pc02-unit-chart';

const team = (id: string, name: string, over: Partial<SnapshotTeam> = {}): SnapshotTeam => ({
  id, name, code: id.toUpperCase(), parentId: null, status: 'ACTIVE', level: 0, wardId: null, ...over,
});

/** Production as measured on 26/11, in miniature: the chart's teams exist except Tổ 1/2/3, nothing is configured. */
function production(over: Partial<ChartSnapshot> = {}): ChartSnapshot {
  const teams: SnapshotTeam[] = [
    team('team_pc02', 'PC02'),
    team(DOI1_TEAM_ID, 'Đội 1 (TT)', { parentId: 'team_pc02', level: 1 }),
    ...[2, 3, 4, 5, 6].map((n) => team(`team_doi${n}_pc02`, `Đội ${n}`, { parentId: 'team_pc02', level: 1 })),
    ...Array.from({ length: 10 }, (_, i) => team(`team_ct${String(i + 1).padStart(2, '0')}_pc02`, `Tổ công tác Số ${i + 1}`, { parentId: 'team_pc02', level: 1 })),
    team('team_cs1_pc02', 'Cơ sở 1', { parentId: 'team_pc02', level: 1 }),
    team('team_cs2_pc02', 'Cơ sở 2', { parentId: 'team_pc02', level: 1 }),
    team('team_truyna_pc02', 'Tổ Truy nã', { parentId: 'team_pc02', level: 1 }),
    team('team_ward_x', 'Công an phường X', { wardId: 'ward-x', parentId: 'team_ct05_pc02' }),
  ];
  return {
    teams,
    memberships: [
      { userId: 'u-admin', teamId: MOVE_SOURCE_TEAM_ID, isLeader: true },
      { userId: 'u-officer', teamId: MOVE_SOURCE_TEAM_ID, isLeader: false },
      { userId: 'u-doi2', teamId: 'team_doi2_pc02', isLeader: false },
    ],
    users: [
      { id: 'u-admin', username: 'admin.doi1', roleName: 'ADMIN', isActive: true, workId: null },
      { id: 'u-officer', username: 'canbo.doi1', roleName: 'OFFICER', isActive: true, workId: '277-001' },
      { id: 'u-doi2', username: 'nguoi.doi2', roleName: 'OFFICER', isActive: true, workId: null },
    ],
    templates: new Map([['STARTER_AS_TODAY', { id: 'tpl-today', status: 'ACTIVE' as const }]]),
    teamConfigs: new Map([['team_ward_x', { doc: chartTeamDoc('tpl-ward'), revision: 3 }]]),
    officerRoleId: 'role-officer',
    appliedMove: null,
    onSource: { petitions: 1746, incidents: 6, cases: 122, deleted: 4, stepParties: 2, pendingHandoffs: 3 },
    ...over,
  };
}

describe('the PC02 unit chart', () => {
  it('names 21 units with distinct teams, and two default accounts per unit with names the login rule accepts', () => {
    expect(CHART_UNITS).toHaveLength(21);
    expect(new Set(CHART_UNITS.map((u) => u.teamId)).size).toBe(21);
    expect(CHART_UNITS.map((u) => u.slug)).toEqual([
      'doi1', 'to1.doi1', 'to2.doi1', 'to3.doi1', 'doi2', 'doi3', 'doi4', 'doi5', 'doi6',
      'tct1', 'tct2', 'tct3', 'tct4', 'tct5', 'tct6', 'tct7', 'tct8', 'tct9', 'tct10', 'cs1', 'cs2',
    ]);
    const plan = planChart(production());
    expect(plan.accountsToCreate).toHaveLength(42);
    for (const a of plan.accountsToCreate) expect(usernameProblems(a.username)).toEqual([]);
    expect(new Set(plan.accountsToCreate.map((a) => a.workId)).size).toBe(42);
  });

  it('only Đội 1 sees as today; every other unit sees only its own team', () => {
    const asToday = CHART_UNITS.filter((u) => u.template === 'STARTER_AS_TODAY').map((u) => u.teamId);
    expect(asToday).toEqual([DOI1_TEAM_ID]);
    expect(CHART_UNITS.find((u) => u.teamId === MOVE_TARGET_TEAM_ID)?.template).toBe('STARTER_TEAM_ONLY');
    expect(CHART_UNITS.find((u) => u.teamId === MOVE_SOURCE_TEAM_ID)?.template).toBe('STARTER_TEAM_ONLY');
  });
});

describe('planChart on production as it is', () => {
  const plan = planChart(production());

  it('has nothing in its way', () => {
    expect(plan.blockers).toEqual([]);
    expect(planHasWork(plan)).toBe(true);
  });

  it('creates the three teams under Đội 1, one level below it', () => {
    expect(plan.teamsToCreate).toEqual([1, 2, 3].map((n) => ({
      id: `team_doi1_to${n}_pc02`, code: `DOI1-TO${n}`, name: `Tổ ${n} – Đội 1`, parentId: DOI1_TEAM_ID, level: 2,
    })));
  });

  it('creates the team-only template, which is missing; "as today" exists', () => {
    expect(plan.startersMissing).toEqual(['STARTER_TEAM_ONLY']);
  });

  it('moves every member of Tổ công tác Số 2, leaders and administrators included, and its records', () => {
    expect(plan.move).toEqual({
      status: 'TODO',
      members: [
        { userId: 'u-admin', username: 'admin.doi1', isLeader: true, admin: true },
        { userId: 'u-officer', username: 'canbo.doi1', isLeader: false, admin: false },
      ],
      records: { petitions: 1746, incidents: 6, cases: 122, deleted: 4, stepParties: 2, pendingHandoffs: 3 },
    });
  });

  it('configures all 21 units; Đội 1 with the existing template, the others with the one this run creates', () => {
    expect(plan.configs).toHaveLength(21);
    expect(plan.configs[0]).toMatchObject({ teamId: DOI1_TEAM_ID, templateCode: 'STARTER_AS_TODAY', templateId: 'tpl-today', change: 'CREATE', revision: 0 });
    expect(plan.configs.slice(1).every((c) => c.templateCode === 'STARTER_TEAM_ONLY' && c.templateId === null && c.change === 'CREATE')).toBe(true);
  });

  it('as on production, no unit has a team under it (a ward unit with its own configuration is not one)', () => {
    expect(plan.inheriting).toEqual([]);
  });

  it('lists the teams the chart does not name (one that follows a unit is not "untouched"), ward units apart', () => {
    expect(plan.untouched.map((t) => t.id)).toEqual(['team_pc02', 'team_truyna_pc02']);
    expect(plan.wardUnits).toBe(1);
  });

  it('names the accounts: head is a leader, officer is not; names read "Trưởng Đội 2", "Cán bộ Tổ công tác Số 4"', () => {
    const doi2 = plan.accountsToCreate.filter((a) => a.unit.slug === 'doi2');
    expect(doi2.map((a) => [a.username, a.lastName, a.firstName, a.isLeader, a.workId])).toEqual([
      ['doi2.truong', 'Trưởng', 'Đội 2', true, 'MD-DOI2-01'],
      ['doi2.canbo', 'Cán bộ', 'Đội 2', false, 'MD-DOI2-02'],
    ]);
    expect(plan.accountsToCreate.find((a) => a.username === 'tct4.canbo')).toMatchObject({ lastName: 'Cán bộ', firstName: 'Tổ công tác Số 4' });
    expect(plan.accountsToCreate.find((a) => a.username === 'to3.doi1.truong')).toMatchObject({ workId: 'MD-TO3DOI1-01', firstName: 'Tổ 3 – Đội 1' });
  });
});

describe('planChart after a successful run: nothing left to do', () => {
  const configs = new Map<string, { doc: ReturnType<typeof chartTeamDoc>; revision: number }>([
    ...CHART_UNITS.map((u): [string, { doc: ReturnType<typeof chartTeamDoc>; revision: number }] => [u.teamId, { doc: chartTeamDoc(u.template === 'STARTER_AS_TODAY' ? 'tpl-today' : 'tpl-team'), revision: 1 }]),
    ['team_ward_x', { doc: chartTeamDoc('tpl-ward'), revision: 3 }],
  ]);
  const done = production();
  const after = planChart({
    ...done,
    teams: [...done.teams, ...[1, 2, 3].map((n) => team(`team_doi1_to${n}_pc02`, `Tổ ${n} – Đội 1`, { parentId: DOI1_TEAM_ID, code: `DOI1-TO${n}` }))],
    memberships: [
      ...done.memberships.map((m) => (m.teamId === MOVE_SOURCE_TEAM_ID ? { ...m, teamId: MOVE_TARGET_TEAM_ID } : m)),
    ],
    users: [
      ...done.users,
      ...CHART_UNITS.flatMap((u) => ['truong', 'canbo'].map((s) => ({ id: `${u.slug}.${s}`, username: `${u.slug}.${s}`, roleName: 'OFFICER', isActive: true, workId: null }))),
    ],
    templates: new Map([
      ['STARTER_AS_TODAY', { id: 'tpl-today', status: 'ACTIVE' as const }],
      ['STARTER_TEAM_ONLY', { id: 'tpl-team', status: 'ACTIVE' as const }],
    ]),
    teamConfigs: configs,
    appliedMove: { id: 'move-1', movedAt: new Date('2026-11-26T10:00:00Z') },
    onSource: { petitions: 0, incidents: 0, cases: 0, deleted: 4, stepParties: 0, pendingHandoffs: 0 },
  });

  it('creates, moves, configures nothing and says the move was done', () => {
    expect(after.blockers).toEqual([]);
    expect(after.teamsToCreate).toEqual([]);
    expect(after.startersMissing).toEqual([]);
    expect(after.move).toMatchObject({ status: 'DONE', moveId: 'move-1' });
    expect(after.configs.every((c) => c.change === 'SAME')).toBe(true);
    expect(after.accountsToCreate).toEqual([]);
    expect(after.accountsExisting).toHaveLength(42);
    expect(planHasWork(after)).toBe(false);
  });
});

describe('a team under a unit with no configuration of its own', () => {
  const withChild = (over: Partial<ChartSnapshot> = {}): ChartSnapshot => {
    const base = production();
    return {
      ...base,
      teams: [...base.teams, team('team_doi2_sub', 'Nhóm A Đội 2', { parentId: 'team_doi2_pc02', level: 2 })],
      memberships: [...base.memberships, { userId: 'u-sub', teamId: 'team_doi2_sub', isLeader: false }],
      users: [...base.users, { id: 'u-sub', username: 'nguoi.sub', roleName: 'OFFICER', isActive: true, workId: null }],
      ...over,
    };
  };

  it('would silently follow the unit\'s new configuration: the plan refuses, naming it and the way out', () => {
    const plan = planChart(withChild());
    expect(plan.inheriting).toEqual([{ teamId: 'team_doi2_sub', name: 'Nhóm A Đội 2', governedBy: 'Đội 2' }]);
    expect(plan.blockers).toEqual([expect.stringMatching(/Nhóm A Đội 2 \(theo Đội 2\).*--giu-cau-hinh-to-con/)]);
    expect(plan.configs.filter((c) => c.kind === 'KEEP_CHILD')).toEqual([]);
  });

  it('an inactive one is listed but does not stop the run (its members get nothing from it)', () => {
    const base = withChild();
    const plan = planChart({ ...base, teams: base.teams.map((t) => (t.id === 'team_doi2_sub' ? { ...t, status: 'INACTIVE' as const } : t)) });
    expect(plan.inheriting).toHaveLength(1);
    expect(plan.blockers).toEqual([]);
  });

  it('with --giu-cau-hinh-to-con: it gets "as today" of its own, so its people keep what their role holds', () => {
    const plan = planChart(withChild(), { keepChildren: true });
    expect(plan.blockers).toEqual([]);
    expect(plan.configs).toHaveLength(22);
    expect(plan.configs.at(-1)).toEqual({
      kind: 'KEEP_CHILD', teamId: 'team_doi2_sub', teamName: 'Nhóm A Đội 2', templateCode: 'STARTER_AS_TODAY', templateId: 'tpl-today',
      copied: null, before: null, revision: 0, change: 'CREATE',
    });
  });

  it('with --giu-cau-hinh-to-con under a team that already has a configuration: that configuration is copied', () => {
    const above = { mode: 'EXPLICIT' as const, memberTemplateId: 'tpl-root', leaderTemplateId: null, overrides: [] };
    const plan = planChart(withChild({ teamConfigs: new Map([['team_pc02', { doc: above, revision: 2 }]]) }), { keepChildren: true });
    expect(plan.configs.find((c) => c.teamId === 'team_doi2_sub')).toMatchObject({ kind: 'KEEP_CHILD', copied: above });
  });

  it('with --giu-cau-hinh-to-con, a member whose role is not the officer\'s cannot be kept as today: refused', () => {
    const base = withChild();
    const plan = planChart({ ...base, users: base.users.map((u) => (u.id === 'u-sub' ? { ...u, roleName: 'INVESTIGATOR' } : u)) }, { keepChildren: true });
    expect(plan.blockers).toEqual([expect.stringMatching(/Nhóm A Đội 2: nguoi\.sub \(INVESTIGATOR\)/)]);
  });
});

describe('planChart refuses what it cannot do safely', () => {
  it('a missing unit, a name or code already taken, an archived template, a missing officer role, a taken work id', () => {
    const base = production();
    const plan = planChart({
      ...base,
      teams: [...base.teams.filter((t) => t.id !== 'team_cs2_pc02'), team('other', 'Tổ 1 – Đội 1'), team('other2', 'x', { code: 'DOI1-TO2' })],
      templates: new Map([['STARTER_AS_TODAY', { id: 'tpl-today', status: 'ARCHIVED' as const }]]),
      officerRoleId: null,
      users: [...base.users, { id: 'u-x', username: 'someone', roleName: 'OFFICER', isActive: true, workId: 'MD-DOI3-01' }],
    });
    expect(plan.blockers).toEqual([
      'Tên "Tổ 1 – Đội 1" đã thuộc tổ khác (other).',
      'Mã "DOI1-TO2" đã thuộc tổ khác (other2).',
      'Không thấy tổ team_cs2_pc02 (Cơ sở 2) trong cơ sở dữ liệu.',
      'Mẫu STARTER_AS_TODAY đang lưu trữ: khôi phục nó trước (màn Phân quyền theo tổ).',
      'Không thấy vai trò OFFICER.',
      'Mã cán bộ MD-DOI3-01 đã thuộc tài khoản someone.',
    ]);
  });

  it('an existing account is left alone (never a new password) and reported with whether it is in its unit', () => {
    const base = production();
    const plan = planChart({
      ...base,
      users: [...base.users, { id: 'u-t', username: 'doi2.truong', roleName: 'OFFICER', isActive: true, workId: null }],
      memberships: [...base.memberships, { userId: 'u-t', teamId: 'team_doi3_pc02', isLeader: false }],
    });
    expect(plan.accountsExisting).toEqual([{ username: 'doi2.truong', inUnit: false }]);
    expect(plan.accountsToCreate).toHaveLength(41);
  });

  it('a configuration that differs is replaced (and shown with what it was); an identical one is left alone', () => {
    const base = production();
    const other = { mode: 'EXPLICIT' as const, memberTemplateId: 'tpl-x', leaderTemplateId: null, overrides: [] };
    const plan = planChart({ ...base, teamConfigs: new Map([['team_doi3_pc02', { doc: other, revision: 5 }], [DOI1_TEAM_ID, { doc: chartTeamDoc('tpl-today'), revision: 2 }]]) });
    expect(plan.configs.find((c) => c.teamId === 'team_doi3_pc02')).toMatchObject({ change: 'REPLACE', before: other, revision: 5 });
    expect(plan.configs.find((c) => c.teamId === DOI1_TEAM_ID)).toMatchObject({ change: 'SAME', revision: 2 });
  });
});
