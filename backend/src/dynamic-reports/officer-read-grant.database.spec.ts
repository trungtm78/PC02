import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';

/**
 * The migration that gives the OFFICER role `read:DynamicReport`, run on REAL PostgreSQL.
 *
 * Production was found (04/11/2026) with the module on, reports set up, and two officers named as the people who enter
 * the figures, while the OFFICER role did not hold the one permission that opens the module's menu and its API: the
 * deploy never runs the permission seed, so the grant the seed makes never reached it. Runs only when
 * `DYN_REPORTS_DATABASE_URL` points at the scratch database.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const MIGRATION = path.join(
  __dirname,
  '../../prisma/migrations/20261104120000_grant_officer_read_dynamic_report/migration.sql',
);

run('OFFICER read:DynamicReport grant on PostgreSQL', () => {
  let db: PrismaClient;
  let pg: Client;
  const tag = `og-${randomUUID().slice(0, 8)}`;
  let officerId: string;
  let otherRoleId: string;
  let permissionId: string;
  let officerHadGrant = false;
  let createdOfficer = false;

  const apply = () => pg.query(fs.readFileSync(MIGRATION, 'utf-8'));
  const grantsOf = (roleId: string) =>
    db.rolePermission.count({ where: { roleId, permissionId } });

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: DYN_REPORTS_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    pg = new Client({ connectionString: url! });
    await pg.connect();
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url! }),
    });

    const permission = await db.permission.upsert({
      where: { action_subject: { action: 'read', subject: 'DynamicReport' } },
      update: {},
      create: { action: 'read', subject: 'DynamicReport' },
    });
    permissionId = permission.id;
    const existing = await db.role.findUnique({ where: { name: 'OFFICER' } });
    createdOfficer = !existing;
    const officer =
      existing ?? (await db.role.create({ data: { name: 'OFFICER' } }));
    officerId = officer.id;
    officerHadGrant = (await grantsOf(officerId)) > 0;
    otherRoleId = (await db.role.create({ data: { name: `${tag}-OTHER` } })).id;
  });

  beforeEach(async () => {
    await db.rolePermission.deleteMany({
      where: { permissionId, roleId: { in: [officerId, otherRoleId] } },
    });
  });

  afterAll(async () => {
    await db.rolePermission.deleteMany({ where: { roleId: otherRoleId } });
    await db.role.delete({ where: { id: otherRoleId } });
    if (createdOfficer) {
      await db.role.delete({ where: { id: officerId } });
    } else if (officerHadGrant) {
      await db.rolePermission.create({
        data: { roleId: officerId, permissionId },
      });
    }
    await db.$disconnect();
    await pg.end();
  });

  it('gives the OFFICER role the permission that opens the report module', async () => {
    await apply();
    expect(await grantsOf(officerId)).toBe(1);
  });

  it('can run again without duplicating or failing', async () => {
    await apply();
    await apply();
    expect(await grantsOf(officerId)).toBe(1);
  });

  it('leaves every other role alone', async () => {
    await apply();
    expect(await grantsOf(otherRoleId)).toBe(0);
  });

  it('keeps a grant the role already had', async () => {
    await db.rolePermission.create({
      data: { roleId: officerId, permissionId },
    });
    await apply();
    expect(await grantsOf(officerId)).toBe(1);
  });

  it('does nothing, and does not fail, when the permission has not been created yet', async () => {
    // Renamed away for the moment (not deleted) so the other roles' grants of it survive in the scratch database.
    await db.permission.update({
      where: { id: permissionId },
      data: { subject: `${tag}-away` },
    });
    try {
      await expect(apply()).resolves.toBeDefined();
      expect(await grantsOf(officerId)).toBe(0);
    } finally {
      await db.permission.update({
        where: { id: permissionId },
        data: { subject: 'DynamicReport' },
      });
    }
  });
});
