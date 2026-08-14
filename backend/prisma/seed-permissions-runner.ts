/**
 * Idempotent permission seed, safe to run on every deploy.
 *
 * `scripts/deploy/deploy.sh` runs `prisma migrate deploy` but never
 * `npm run db:seed` — and it must not, because seed.ts creates and updates user
 * accounts and needs SEED_ADMIN_PASSWORD. So a PR that adds a new
 * `@RequirePermissions({ action, subject })` ships an endpoint whose permission
 * row does not exist in production. PermissionsGuard has no ADMIN bypass: it
 * looks the permission up and denies when it is missing, so the endpoint 403s
 * for *everyone*, super-admin included.
 *
 * That is ISSUE-001, already documented in seed-permissions.ts — `Setting` was
 * missing and /admin/settings was dead for every role. This runner exists so it
 * cannot happen a third time.
 *
 * Scope, deliberately narrow:
 *   1. upsert every SEED_PERMISSIONS row
 *   2. grant every permission in the table to ADMIN
 *   3. apply DEFAULT_ROLE_GRANTS to the rows created in step 1 ONLY
 *
 * Step 3 exists because granting to ADMIN alone does not fix the problem. The
 * Evidence endpoints are for investigators; an OFFICER grant that lives only in
 * seed.ts never reaches production, so the module would 403 for exactly the
 * people it was built for. Restricting it to newly created rows means an admin
 * who revokes a permission in the UI keeps that decision — the next deploy will
 * not silently hand it back.
 *
 * It does not touch users or any business data.
 *
 * Usage: cd backend && npx ts-node prisma/seed-permissions-runner.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  SEED_PERMISSIONS,
  DEFAULT_ROLE_GRANTS,
  permissionKey,
} from './seed-permissions';

const ADMIN_ROLE_NAME = 'ADMIN';

export async function seedPermissionsAndGrantAdmin(
  prisma: PrismaClient,
): Promise<{ permissions: number; grants: number; roleGrants: number }> {
  // Permissions created on THIS run. Only these get their default role grants;
  // see DEFAULT_ROLE_GRANTS for why re-granting existing ones would be wrong.
  const created: { id: string; key: string }[] = [];

  for (const perm of SEED_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: {
        action_subject: { action: perm.action, subject: perm.subject },
      },
      select: { id: true },
    });
    const row = await prisma.permission.upsert({
      where: {
        action_subject: { action: perm.action, subject: perm.subject },
      },
      update: { description: perm.description },
      create: {
        action: perm.action,
        subject: perm.subject,
        description: perm.description,
      },
      select: { id: true },
    });
    if (!existing) {
      created.push({
        id: row.id,
        key: permissionKey(perm.action, perm.subject),
      });
    }
  }

  const adminRole = await prisma.role.findFirst({
    where: { name: ADMIN_ROLE_NAME },
  });
  if (!adminRole) {
    // A database without an ADMIN role has never been seeded at all; that is a
    // job for db:seed, not for this runner.
    console.warn(
      `[seed-permissions] role ${ADMIN_ROLE_NAME} not found — skipping grants. Run npm run db:seed first.`,
    );
    return { permissions: SEED_PERMISSIONS.length, grants: 0, roleGrants: 0 };
  }

  const all = await prisma.permission.findMany({ select: { id: true } });
  for (const perm of all) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // Default grants for non-admin roles, newly created permissions only.
  let roleGrants = 0;
  for (const [roleName, keys] of Object.entries(DEFAULT_ROLE_GRANTS)) {
    const wanted = created.filter((c) => keys.includes(c.key));
    if (wanted.length === 0) continue;

    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      console.warn(
        `[seed-permissions] role ${roleName} not found — skipping its default grants.`,
      );
      continue;
    }
    for (const perm of wanted) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
      roleGrants += 1;
      console.log(`[seed-permissions] granted ${perm.key} to ${roleName}`);
    }
  }

  return {
    permissions: SEED_PERMISSIONS.length,
    grants: all.length,
    roleGrants,
  };
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[seed-permissions] DATABASE_URL missing');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });

  try {
    const { permissions, grants, roleGrants } =
      await seedPermissionsAndGrantAdmin(prisma);
    console.log(
      `[seed-permissions] ${permissions} permission(s) upserted, ${grants} granted to ${ADMIN_ROLE_NAME}, ${roleGrants} default grant(s) to other roles.`,
    );
  } catch (e) {
    console.error('[seed-permissions] FAILED:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
