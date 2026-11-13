import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const MARKER = '-- TRIGGER-SECTION';
const triggersOf = (migration: string): string => {
  const sql = readFileSync(join(__dirname, '../../prisma/migrations', migration, 'migration.sql'), 'utf8');
  const at = sql.indexOf(MARKER);
  if (at < 0) throw new Error(`${migration} lost its TRIGGER-SECTION marker`);
  return sql.slice(at);
};

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

run('authz foundation on PostgreSQL', () => {
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
   * How far the counter moves for one statement. The counter row is locked first, so nothing another connection does
   * meanwhile can be mistaken for this statement's doing; everything is rolled back.
   */
  async function bumps(sql: string, params: unknown[] = []): Promise<number> {
    await pg.query('BEGIN');
    try {
      const before = await pg.query('SELECT "revision" FROM "authz_revision" WHERE "id" = 1 FOR UPDATE');
      await pg.query(sql, params);
      const after = await pg.query('SELECT "revision" FROM "authz_revision" WHERE "id" = 1');
      return Number(after.rows[0].revision) - Number(before.rows[0].revision);
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
    await pg.query(triggersOf('20261113100000_team_status'));
    await pg.query(triggersOf('20261114100000_authz_foundation'));
    await pg.query('INSERT INTO "authz_revision" ("id", "revision") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING');

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

    it('a team moved under another, paused, or created; one statement over many rows counts once', async () => {
      const parent = await team();
      const a = await team();
      await team();
      expect(await bumps('UPDATE "teams" SET "parentId" = $1 WHERE "id" = $2', [parent.id, a.id])).toBe(1);
      expect(await bumps(`UPDATE "teams" SET "status" = 'INACTIVE' WHERE "id" = $1`, [a.id])).toBe(1);
      expect(await bumps(`UPDATE "teams" SET "status" = 'INACTIVE' WHERE "code" LIKE $1`, [`${tag}-%`])).toBe(1);
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
