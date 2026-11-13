import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthzController } from './authz.controller';
import { AuthzLookupService } from './authz-lookup.service';
import { AuthzService } from './authz.service';

/**
 * AuthzService on a REAL PostgreSQL: it reads the configuration as it is stored, answers per person, and notices a
 * change through the revision counter the triggers keep (not through anything the application remembers to call).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('AuthzService on PostgreSQL', () => {
  let db: PrismaClient;
  let pg: Client;
  let service: AuthzService;
  let lookup: AuthzLookupService;
  const tag = `as-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const perm: Record<string, string> = {};

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    const sql = readFileSync(join(__dirname, '../../prisma/migrations/20261114100000_authz_foundation/migration.sql'), 'utf8');
    await pg.query(sql.slice(sql.indexOf('-- TRIGGER-SECTION')));

    for (const [action, subject] of [['read', 'Case'], ['edit', 'Case'], ['delete', 'Case'], ['read', 'Directory']]) {
      const row = await db.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } });
      perm[`${action}:${subject}`] = row.id;
    }
    const role = await db.role.create({
      data: { name: `${tag}-officer`, permissions: { create: ['read:Case', 'edit:Case', 'read:Directory'].map((p) => ({ permissionId: perm[p] })) } },
    });
    id.role = role.id;
    for (const name of ['member', 'leader', 'loner', 'off']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id, isActive: name !== 'off' } })).id;
    }
    id.A = (await db.team.create({ data: { code: `${tag}-A`, name: `${tag} Tổ A` } })).id;
    id.A1 = (await db.team.create({ data: { code: `${tag}-A1`, name: `${tag} Tổ A1`, parentId: id.A } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.member, teamId: id.A1 },
        { userId: id.leader, teamId: id.A, isLeader: true },
      ],
    });
    id.memberTpl = (
      await db.permissionTemplate.create({
        data: { code: `${tag}-m`, name: `${tag} Cán bộ`, entries: { create: [{ permissionId: perm['read:Case'], reach: 'OWN' }] } },
      })
    ).id;
    id.leaderTpl = (
      await db.permissionTemplate.create({
        data: {
          code: `${tag}-l`,
          name: `${tag} Lãnh đạo`,
          entries: { create: [{ permissionId: perm['read:Case'], reach: 'TEAM_TREE' }, { permissionId: perm['delete:Case'], reach: 'TEAM' }] },
        },
      })
    ).id;
    service = new AuthzService(db as never);
    lookup = new AuthzLookupService(service);
  });

  afterAll(async () => {
    await db.userPermissionOverride.deleteMany({ where: { user: { username: { startsWith: tag } } } });
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag }, parentId: { not: null } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  it('with nothing configured, a person has what the role holds, reaching the team as today', async () => {
    const e = await service.effective(id.member);
    expect(e.keys).toEqual(['edit:Case', 'read:Case', 'read:Directory']);
    expect(e.grants.get('read:Case')).toEqual([{ reach: 'TEAM_TREE', teamId: id.A1, source: { kind: 'ROLE', teamId: id.A1 } }]);
    expect(e.activeTeamIds).toEqual([id.A1]);
  });

  it('the same answer is kept while nothing changes (no second read of the configuration)', async () => {
    const first = await service.snapshot();
    const again = await service.snapshot();
    expect(again).toBe(first);
    expect(await service.effective(id.member)).toBe(await service.effective(id.member));
  });

  it('a configuration saved for the parent team is noticed by itself and reaches the child team that has none', async () => {
    const before = await service.snapshot();
    await db.teamPermissionConfig.create({
      data: { teamId: id.A, mode: 'EXPLICIT', memberTemplateId: id.memberTpl, leaderTemplateId: id.leaderTpl },
    });

    const after = await service.snapshot();
    expect(after).not.toBe(before);
    expect(after.revision).not.toBe(before.revision);
    expect((await service.effective(id.member)).keys).toEqual(['read:Case']);
    expect((await service.effective(id.leader)).keys).toEqual(['delete:Case', 'read:Case']);
    // Somebody in no team keeps the role.
    expect((await service.effective(id.loner)).keys).toEqual(['edit:Case', 'read:Case', 'read:Directory']);
  });

  it('a personal override is read with its end, and the answer is not kept past it', async () => {
    const end = new Date(Date.now() + 60_000);
    await db.userPermissionOverride.create({
      data: { userId: id.member, permissionId: perm['read:Directory'], effect: 'GRANT', reach: 'ALL', reason: 'spec', expiresAt: end },
    });
    const now = await service.effective(id.member);
    expect(now.keys).toEqual(['read:Case', 'read:Directory']);
    expect(now.validUntil).toEqual(end);
    const later = await service.effective(id.member, new Date(end.getTime() + 1));
    expect(later.keys).toEqual(['read:Case']);
  });

  it('pausing the team is noticed: its membership stops counting and the person falls back to the role', async () => {
    await db.team.update({ where: { id: id.A1 }, data: { status: 'INACTIVE' } });
    const e = await service.effective(id.member, new Date(Date.now() + 120_000));
    expect(e.activeTeamIds).toEqual([]);
    expect(e.keys).toEqual(['edit:Case', 'read:Case', 'read:Directory']);
    await db.team.update({ where: { id: id.A1 }, data: { status: 'ACTIVE' } });
  });

  it('a person created after the configuration was read is found (their creation is a change too)', async () => {
    await service.snapshot();
    const created = await db.user.create({ data: { username: `${tag}-late`, passwordHash: 'x', roleId: id.role } });
    expect((await service.effective(created.id)).keys).toEqual(['edit:Case', 'read:Case', 'read:Directory']);
  });

  it('an answer asked against an older snapshot is computed from THAT snapshot and not kept', async () => {
    const old = await service.snapshot();
    await db.userTeam.create({ data: { userId: id.loner, teamId: id.A1 } });
    const current = await service.snapshot();
    expect(current).not.toBe(old);
    expect(service.effectiveIn(old, id.loner).activeTeamIds).toEqual([]);
    expect(service.effectiveIn(current, id.loner).activeTeamIds).toEqual([id.A1]);
    expect(service.effectiveIn(current, id.loner)).toBe(await service.effective(id.loner));
    await db.userTeam.delete({ where: { userId_teamId: { userId: id.loner, teamId: id.A1 } } });
  });

  it('someone unknown or switched off is not found', async () => {
    await expect(service.effective('nobody')).rejects.toMatchObject({ response: { code: 'AUTHZ_USER_NOT_FOUND' } });
    await expect(service.effective(id.off)).rejects.toMatchObject({ response: { code: 'AUTHZ_USER_NOT_FOUND' } });
  });

  it('the mode is OFF unless the setting says one of the three words', async () => {
    const KEY = 'QUYEN_THEO_TO_CHE_DO';
    const existing = await db.systemSetting.findUnique({ where: { key: KEY } });
    try {
      await db.systemSetting.deleteMany({ where: { key: KEY } });
      expect(await service.mode()).toBe('OFF');
      await db.systemSetting.create({ data: { key: KEY, value: 'SHADOW', label: 'x' } });
      expect(await service.mode()).toBe('SHADOW');
      await db.systemSetting.update({ where: { key: KEY }, data: { value: 'enforce!' } });
      expect(await service.mode()).toBe('OFF');
    } finally {
      await db.systemSetting.deleteMany({ where: { key: KEY } });
      if (existing) await db.systemSetting.create({ data: { key: KEY, value: existing.value, label: existing.label } });
    }
  });

  describe('the look-up the permission screens read', () => {
    it('lists the catalogue with what can be limited by records', () => {
      const cases = lookup.catalogue().find((r) => r.key === 'cases')!;
      expect(cases).toMatchObject({ group: 'business', recordScoped: true, basic: { view: 'read:Case', delete: 'delete:Case' }, extras: { restore: 'restore:Case' } });
      expect(lookup.catalogue().find((r) => r.key === 'users')).toMatchObject({ recordScoped: false, sensitive: ['write:User', 'delete:User'] });
    });

    it('says for each permission whether the person has it, how far, through which team and template', async () => {
      const view = await lookup.effectiveOf(id.leader);
      expect(view).toMatchObject({ userId: id.leader, admin: false, teams: [{ id: id.A, name: `${tag} Tổ A` }] });
      const read = view.permissions.find((p) => p.permission === 'read:Case')!;
      expect(read).toMatchObject({
        resource: 'cases',
        reach: 'TEAM_TREE',
        grants: [{ source: 'TEMPLATE', teamName: `${tag} Tổ A`, configTeamName: `${tag} Tổ A`, templateName: `${tag} Lãnh đạo`, asLeader: true }],
        reaches: { all: false, own: true, unassigned: true },
      });
      expect(read.reaches!.teams.map((t) => t.name).sort()).toEqual([`${tag} Tổ A`, `${tag} Tổ A1`]);
      const remove = view.permissions.find((p) => p.permission === 'delete:Case')!;
      expect(remove).toMatchObject({ reach: 'TEAM', reaches: { own: false, teams: [{ id: id.A }], unassigned: false } });
      // Not granted: present in the list, with no reach and nothing it reaches.
      expect(view.permissions.find((p) => p.permission === 'edit:Case')).toMatchObject({ reach: null, grants: [], reaches: null });
      // Every permission of the catalogue is answered.
      expect(view.permissions.length).toBe(lookup.catalogue().reduce((n, r) => n + new Set([...Object.values(r.basic), ...Object.values(r.extras)]).size, 0));
    });

    it('a team the person may only READ through a data access grant is not shown as one they may change', async () => {
      const granted = await db.team.create({ data: { code: `${tag}-G`, name: `${tag} Tổ G` } });
      await db.dataAccessGrant.create({ data: { granteeId: id.leader, teamId: granted.id, accessLevel: 'READ', grantedById: id.leader } });
      const view = await lookup.effectiveOf(id.leader);
      const names = (permission: string) => view.permissions.find((p) => p.permission === permission)!.reaches!.teams.map((t) => t.name);
      expect(names('read:Case')).toContain(`${tag} Tổ G`);
      expect(names('delete:Case')).not.toContain(`${tag} Tổ G`);
      await db.dataAccessGrant.deleteMany({ where: { teamId: granted.id } });
    });

    it('shows what an override took away and from whom it came', async () => {
      await db.userPermissionOverride.create({
        data: { userId: id.leader, permissionId: perm['delete:Case'], effect: 'MUTE', reason: 'spec' },
      });
      const view = await lookup.effectiveOf(id.leader);
      expect(view.permissions.find((p) => p.permission === 'delete:Case')).toMatchObject({
        reach: null,
        mutedBy: [{ source: 'USER_OVERRIDE', teamId: null, teamName: null }],
      });
    });

    it('the controller hands out the catalogue with the mode, and the look-up of a person', async () => {
      const controller = new AuthzController(service, lookup);
      const catalogue = await controller.catalogue();
      expect(catalogue.mode).toBe('OFF');
      expect(catalogue.resources.length).toBeGreaterThan(15);
      expect((await controller.effective(id.loner)).userId).toBe(id.loner);
    });
  });
});
