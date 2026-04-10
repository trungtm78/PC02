/**
 * Seed: Add Petition permissions for TASK-2026-260202 E2E tests
 * Run: npx ts-node prisma/seed-petition-permissions.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Petition permissions ────────────────────────────────────────────────────
  const petitionPerms = [
    { action: 'read', subject: 'Petition' },
    { action: 'write', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
    { action: 'delete', subject: 'Petition' },
  ];

  const createdPerms: Array<{ id: string; action: string; subject: string }> = [];
  for (const perm of petitionPerms) {
    const p = await prisma.permission.upsert({
      where: { action_subject: perm },
      update: {},
      create: perm,
    });
    createdPerms.push(p);
    console.log(`Permission created: ${perm.action}:${perm.subject}`);
  }

  // ── Assign to ADMIN role ────────────────────────────────────────────────────
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (adminRole) {
    for (const perm of createdPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
    console.log('Petition permissions assigned to ADMIN role');
  }

  // ── Assign to OFFICER role ──────────────────────────────────────────────────
  const officerRole = await prisma.role.findUnique({ where: { name: 'OFFICER' } });
  if (officerRole) {
    for (const perm of createdPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: officerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: officerRole.id, permissionId: perm.id },
      });
    }
    console.log('Petition permissions assigned to OFFICER role');
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
