import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { installTriggerSection } from '../common/testing/install-trigger-section';
import { randomUUID } from 'node:crypto';
import { TeamLifecycleService } from '../teams/team-lifecycle.service';
import { TeamMergeService } from '../teams/team-merge.service';

/**
 * The tables of "permissions by team" on a REAL PostgreSQL: the revision counter moves when, and only when,
 * something effective permissions are computed from changes; and a team's own permission configuration neither
 * blocks deleting the team nor travels in a merge.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('authz foundation on PostgreSQL', () => {
  // Shares a scratch database with other suites when the whole suite runs in parallel workers.
  jest.setTimeout(30_000);
  let db: PrismaClient;
  let pg: Client;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `az-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let roleId = '';
  let otherRoleId = '';
  let userId = '';
  let permissionId = '';
  let templateId = '';
  const team = (data: Record<string, unknown> = {}) => {
    n += 1;
    return db.team.create({ data: { code: `${tag}-${n}`, name: `${tag}-${n}`, ...data } });
  };

  /**
   * How many change rows one statement leaves. Counted inside a REPEATABLE READ transaction: what other connections
   * commit meanwhile is not seen, so it cannot be mistaken for this statement's doing. Everything is rolled back.
   */
  async function bumps(sql: string, params: unknown[] = []): Promise<number> {
    await pg.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try {
      const count = async () => Number((await pg.query('SELECT count(*)::int AS n FROM "authz_changes"')).rows[0].n);
      const before = await count();
      await pg.query(sql, params);
      return (await count()) - before;
    } finally {
      await pg.query('ROLLBACK');
    }
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    // `prisma db push` (how the CI scratch schema is built) creates tables but no triggers and no rows.
    await installTriggerSection(pg, '20261113100000_team_status', 'teams_status_sync');
    await installTriggerSection(pg, '20261114100000_authz_foundation', 'authz_bump');

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    otherRoleId = (await db.role.create({ data: { name: `${tag}-role2` } })).id;
    userId = (await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId } })).id;
    permissionId = (await db.permission.create({ data: { action: `${tag}-act`, subject: 'AuthzSpec' } })).id;
    templateId = (await db.permissionTemplate.create({ data: { code: `${tag}-tpl`, name: `${tag} mẫu` } })).id;
  });

  afterAll(async () => {
    await db.teamPermissionConfig.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.permissionTemplate.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.permission.deleteMany({ where: { subject: 'AuthzSpec' } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await db.systemSetting.deleteMany({ where: { key: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  describe('the revision counter moves when effective permissions can have changed', () => {
    it('a membership added, a leader flag changed, a membership removed', async () => {
      const t = await team();
      expect(await bumps('INSERT INTO "user_teams" ("userId", "teamId") VALUES ($1, $2)', [userId, t.id])).toBe(1);
      await db.userTeam.create({ data: { userId, teamId: t.id } });
      expect(await bumps('UPDATE "user_teams" SET "isLeader" = true WHERE "teamId" = $1', [t.id])).toBe(1);
      expect(await bumps('DELETE FROM "user_teams" WHERE "teamId" = $1', [t.id])).toBe(1);
    });

    it('a role given or losing a permission', async () => {
      expect(await bumps('INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES ($1, $2)', [roleId, permissionId])).toBe(1);
    });

    it('a data access grant', async () => {
      const t = await team();
      expect(
        await bumps(
          `INSERT INTO "data_access_grants" ("id", "granteeId", "teamId", "accessLevel", "grantedById") VALUES ($1, $2, $3, 'READ', $2)`,
          [`${tag}-g`, userId, t.id],
        ),
      ).toBe(1);
    });

    it('a team moved under another, paused, or created', async () => {
      const parent = await team();
      const a = await team();
      await team();
      expect(await bumps('UPDATE "teams" SET "parentId" = $1 WHERE "id" = $2', [parent.id, a.id])).toBe(1);
      expect(await bumps(`UPDATE "teams" SET "status" = 'INACTIVE' WHERE "id" = $1`, [a.id])).toBe(1);
      expect(
        await bumps(`INSERT INTO "teams" ("id", "name", "code", "updatedAt") VALUES ($1, $1, $1, now())`, [`${tag}-new`]),
      ).toBe(1);
    });

    it('a user changing role, being switched off, or becoming a dispatcher', async () => {
      expect(await bumps('UPDATE "users" SET "roleId" = $1 WHERE "id" = $2', [otherRoleId, userId])).toBe(1);
      expect(await bumps('UPDATE "users" SET "isActive" = false WHERE "id" = $1', [userId])).toBe(1);
      expect(await bumps('UPDATE "users" SET "canDispatch" = true WHERE "id" = $1', [userId])).toBe(1);
    });

    it('a template, its entries, a team configuration and overrides', async () => {
      const t = await team();
      expect(await bumps('UPDATE "permission_templates" SET "name" = $1 WHERE "id" = $2', ['x', templateId])).toBe(1);
      expect(
        await bumps(`INSERT INTO "permission_template_entries" ("templateId", "permissionId", "reach") VALUES ($1, $2, 'OWN')`, [templateId, permissionId]),
      ).toBe(1);
      expect(
        await bumps(`INSERT INTO "team_permission_configs" ("teamId", "mode", "updatedAt") VALUES ($1, 'EXPLICIT', now())`, [t.id]),
      ).toBe(1);
      await db.teamPermissionConfig.create({ data: { teamId: t.id, mode: 'EXPLICIT', memberTemplateId: templateId } });
      expect(
        await bumps(
          `INSERT INTO "team_permission_overrides" ("id", "teamId", "permissionId", "effect", "reason") VALUES ($1, $2, $3, 'MUTE', 'r')`,
          [`${tag}-o`, t.id, permissionId],
        ),
      ).toBe(1);
      expect(
        await bumps(
          `INSERT INTO "user_permission_overrides" ("id", "userId", "permissionId", "effect", "reach", "reason") VALUES ($1, $2, $3, 'GRANT', 'ALL', 'r')`,
          [`${tag}-uo`, userId, permissionId],
        ),
      ).toBe(1);
    });

    it('the mode setting written, changed or removed', async () => {
      const KEY = 'QUYEN_THEO_TO_CHE_DO';
      // Rolled back each time, so this spec never leaves or changes the real key.
      const present = (await db.systemSetting.count({ where: { key: KEY } })) > 0;
      const write = present
        ? `UPDATE "system_settings" SET "value" = "value" WHERE "key" = $1`
        : `INSERT INTO "system_settings" ("id", "key", "value", "label", "updatedAt") VALUES ($1, $1, 'OFF', 'x', now())`;
      expect(await bumps(write, [KEY])).toBe(1);
    });
  });

  describe('people, roles and permissions themselves', () => {
    it('a person created or removed', async () => {
      const insert = `INSERT INTO "users" ("id", "username", "passwordHash", "roleId", "updatedAt") VALUES ($1, $1, 'x', $2, now())`;
      expect(await bumps(insert, [`${tag}-new-user`, roleId])).toBe(1);
      const gone = await db.user.create({ data: { username: `${tag}-gone`, passwordHash: 'x', roleId } });
      expect(await bumps('DELETE FROM "users" WHERE "id" = $1', [gone.id])).toBe(1);
    });

    it('a role renamed (the name decides who is ADMIN), created or removed; the same name written again is not a change', async () => {
      expect(await bumps('UPDATE "roles" SET "name" = $1 WHERE "id" = $2', [`${tag}-renamed`, otherRoleId])).toBe(1);
      expect(await bumps('UPDATE "roles" SET "name" = "name", "description" = $1 WHERE "id" = $2', ['d', otherRoleId])).toBe(0);
      expect(await bumps(`INSERT INTO "roles" ("id", "name", "updatedAt") VALUES ($1, $1, now())`, [`${tag}-role3`])).toBe(1);
    });

    it('a permission created or redefined; the seed rewriting it with the same values is not a change', async () => {
      expect(await bumps(`INSERT INTO "permissions" ("id", "action", "subject") VALUES ($1, $1, 'AuthzSpec')`, [`${tag}-p2`])).toBe(1);
      expect(await bumps('UPDATE "permissions" SET "action" = $1 WHERE "id" = $2', [`${tag}-other`, permissionId])).toBe(1);
      expect(
        await bumps('UPDATE "permissions" SET "action" = "action", "subject" = "subject", "description" = $1 WHERE "id" = $2', ['d', permissionId]),
      ).toBe(0);
    });
  });

  describe('the change log is not a lock', () => {
    it('two writers that both leave a change do not wait for each other (a counter row would make the second queue, and deadlock a merge)', async () => {
      const t = await team();
      const other = new Client({ connectionString: url! });
      await other.connect();
      try {
        await pg.query('BEGIN');
        await pg.query('INSERT INTO "user_teams" ("userId", "teamId") VALUES ($1, $2)', [userId, t.id]);
        // The first writer has not committed. The second must go through at once, not wait for it.
        await other.query('BEGIN');
        await other.query(`SET LOCAL lock_timeout = '2s'`);
        await other.query(`UPDATE "teams" SET "status" = 'INACTIVE' WHERE "id" = $1`, [(await team()).id]);
        await other.query('COMMIT');
      } finally {
        await pg.query('ROLLBACK');
        await other.end();
      }
    });

    it('a change is seen by a reader only once it is committed', async () => {
      const t = await team();
      const reader = new Client({ connectionString: url! });
      await reader.connect();
      // The row this very transaction leaves, looked for by its id: other suites writing to the same scratch
      // database at the same time cannot be mistaken for it.
      const seen = async (rowId: string) =>
        Number((await reader.query('SELECT count(*)::int AS n FROM "authz_changes" WHERE "id" = $1', [rowId])).rows[0].n);
      try {
        await pg.query('BEGIN');
        await pg.query('INSERT INTO "user_teams" ("userId", "teamId") VALUES ($1, $2)', [userId, t.id]);
        const mine = String((await pg.query(`SELECT currval(pg_get_serial_sequence('authz_changes', 'id')) AS id`)).rows[0].id);
        expect(await seen(mine)).toBe(0);
        await pg.query('COMMIT');
        expect(await seen(mine)).toBe(1);
      } finally {
        await pg.query('ROLLBACK').catch(() => undefined);
        await reader.end();
      }
    });
  });

  describe('a statement that touches no row is not a change', () => {
    it('a delete or an update that matches nothing', async () => {
      expect(await bumps('DELETE FROM "user_teams" WHERE "teamId" = $1', [`${tag}-nothing`])).toBe(0);
      expect(await bumps('UPDATE "data_access_grants" SET "expiresAt" = now() WHERE "teamId" = $1', [`${tag}-nothing`])).toBe(0);
      expect(await bumps('DELETE FROM "users" WHERE "id" = $1', [`${tag}-nothing`])).toBe(0);
    });

    it('removing a person with no memberships, grants or overrides is one change, not one per cascade', async () => {
      const gone = await db.user.create({ data: { username: `${tag}-bare`, passwordHash: 'x', roleId } });
      expect(await bumps('DELETE FROM "users" WHERE "id" = $1', [gone.id])).toBe(1);
    });

    it('a team rewritten with the same parent, state and ward', async () => {
      const t = await team();
      expect(await bumps('UPDATE "teams" SET "parentId" = "parentId", "status" = "status", "wardId" = "wardId" WHERE "id" = $1', [t.id])).toBe(0);
    });
  });

  describe('and stays still when they cannot have', () => {
    it('a user signing in (lastLoginAt, failed attempts) or renamed', async () => {
      expect(await bumps('UPDATE "users" SET "lastLoginAt" = now(), "failedLoginAttempts" = 3 WHERE "id" = $1', [userId])).toBe(0);
      expect(await bumps('UPDATE "users" SET "firstName" = $1 WHERE "id" = $2', ['A', userId])).toBe(0);
    });

    it('a user row rewritten with the same role, state and dispatch flag', async () => {
      expect(
        await bumps('UPDATE "users" SET "roleId" = "roleId", "isActive" = "isActive", "canDispatch" = "canDispatch" WHERE "id" = $1', [userId]),
      ).toBe(0);
    });

    it('a team renamed or reordered', async () => {
      const t = await team();
      expect(await bumps('UPDATE "teams" SET "name" = $1, "order" = 9 WHERE "id" = $2', [`${tag}-renamed`, t.id])).toBe(0);
    });

    it('another setting', async () => {
      expect(
        await bumps(`INSERT INTO "system_settings" ("id", "key", "value", "label", "updatedAt") VALUES ($1, $1, '1', 'x', now())`, [`${tag}-other`]),
      ).toBe(0);
    });
  });

  describe("a team's permission configuration is the team's own setting", () => {
    it('does not block deleting the team, and goes with it (overrides included)', async () => {
      const lifecycle = new TeamLifecycleService(db as never, audit as never);
      const t = await team();
      await db.teamPermissionConfig.create({
        data: {
          teamId: t.id,
          mode: 'EXPLICIT',
          memberTemplateId: templateId,
          overrides: { create: { permissionId, effect: 'MUTE', reason: 'r' } },
        },
      });

      expect(await lifecycle.deletionCheck(t.id)).toEqual({ deletable: true, total: 0, blockers: [] });
      await lifecycle.deleteIfEmpty(t.id, userId);

      expect(await db.team.findUnique({ where: { id: t.id } })).toBeNull();
      expect(await db.teamPermissionConfig.count({ where: { teamId: t.id } })).toBe(0);
      expect(await db.teamPermissionOverride.count({ where: { teamId: t.id } })).toBe(0);
      // The template is not the team's: it stays.
      expect(await db.permissionTemplate.count({ where: { id: templateId } })).toBe(1);
    });

    it('a template a team uses cannot be deleted from under it', async () => {
      const t = await team();
      const used = await db.permissionTemplate.create({ data: { code: `${tag}-used`, name: `${tag} dùng` } });
      await db.teamPermissionConfig.create({ data: { teamId: t.id, mode: 'EXPLICIT', leaderTemplateId: used.id } });
      await expect(db.permissionTemplate.delete({ where: { id: used.id } })).rejects.toThrow();
    });

    it('a merge knows the reference, leaves the configuration with the source team and says so', async () => {
      const lifecycle = new TeamLifecycleService(db as never, audit as never);
      const merge = new TeamMergeService(db as never, audit as never, lifecycle);
      expect(await merge.unsupportedReferences()).toEqual([]);
      const source = await team();
      const target = await team();
      await db.teamPermissionConfig.create({ data: { teamId: source.id, mode: 'EXPLICIT', memberTemplateId: templateId } });

      const preview = await merge.preview(source.id, target.id);
      expect(preview.summary.skipped).toContainEqual({ table: 'team_permission_configs', column: 'teamId', count: 1, reason: 'OWN_SETTINGS' });

      const result = await merge.merge(source.id, target.id, userId);
      expect(result.summary.skipped).toContainEqual({ table: 'team_permission_configs', column: 'teamId', count: 1, reason: 'OWN_SETTINGS' });
      expect(await db.teamPermissionConfig.count({ where: { teamId: source.id } })).toBe(1);
      expect(await db.teamPermissionConfig.count({ where: { teamId: target.id } })).toBe(0);
    });
  });
});
