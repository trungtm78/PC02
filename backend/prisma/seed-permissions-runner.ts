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
 *   2. grant all of them to ADMIN
 * It does not touch users, other roles, or any business data. Grants for
 * OFFICER and others stay in seed.ts, where they are a product decision rather
 * than a deploy-time repair.
 *
 * Usage: cd backend && npx ts-node prisma/seed-permissions-runner.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SEED_PERMISSIONS } from './seed-permissions';

const ADMIN_ROLE_NAME = 'ADMIN';

export async function seedPermissionsAndGrantAdmin(
  prisma: PrismaClient,
): Promise<{ permissions: number; grants: number }> {
  for (const perm of SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        action_subject: { action: perm.action, subject: perm.subject },
      },
      update: { description: perm.description },
      create: {
        action: perm.action,
        subject: perm.subject,
        description: perm.description,
      },
    });
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
    return { permissions: SEED_PERMISSIONS.length, grants: 0 };
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

  return { permissions: SEED_PERMISSIONS.length, grants: all.length };
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
    const { permissions, grants } = await seedPermissionsAndGrantAdmin(prisma);
    console.log(
      `[seed-permissions] ${permissions} permission(s) upserted, ${grants} granted to ${ADMIN_ROLE_NAME}.`,
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
