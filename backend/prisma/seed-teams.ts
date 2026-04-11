/**
 * Seed: Teams, Groups, and Team permissions
 * Run: npx ts-node prisma/seed-teams.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Groups (Nhóm - level 0) ────────────────────────────────────────────────
  const groups = [
    { name: 'Nhóm 1', code: 'NHOM-1', level: 0, order: 1 },
    { name: 'Nhóm 2', code: 'NHOM-2', level: 0, order: 2 },
    { name: 'Nhóm 3', code: 'NHOM-3', level: 0, order: 3 },
    { name: 'Nhóm 4', code: 'NHOM-4', level: 0, order: 4 },
  ];

  const createdGroups: Record<string, string> = {};
  for (const group of groups) {
    const g = await prisma.team.upsert({
      where: { code: group.code },
      update: {},
      create: group,
    });
    createdGroups[group.code] = g.id;
    console.log(`Group created: ${group.name} (${group.code})`);
  }

  // ── Teams (Tổ - level 1) ──────────────────────────────────────────────────
  const teams = [
    { name: 'Tổ 01', code: 'TO-01', level: 1, order: 1, parentCode: 'NHOM-1' },
    { name: 'Tổ 02', code: 'TO-02', level: 1, order: 2, parentCode: 'NHOM-1' },
    { name: 'Tổ 03', code: 'TO-03', level: 1, order: 3, parentCode: 'NHOM-1' },
    { name: 'Tổ 04', code: 'TO-04', level: 1, order: 4, parentCode: 'NHOM-1' },
    { name: 'Tổ 05', code: 'TO-05', level: 1, order: 5, parentCode: 'NHOM-1' },
    { name: 'Tổ 06', code: 'TO-06', level: 1, order: 1, parentCode: 'NHOM-2' },
    { name: 'Tổ 07', code: 'TO-07', level: 1, order: 2, parentCode: 'NHOM-2' },
    { name: 'Tổ 08', code: 'TO-08', level: 1, order: 3, parentCode: 'NHOM-2' },
    { name: 'Tổ 09', code: 'TO-09', level: 1, order: 4, parentCode: 'NHOM-2' },
    { name: 'Tổ 10', code: 'TO-10', level: 1, order: 1, parentCode: 'NHOM-3' },
    { name: 'Tổ 11', code: 'TO-11', level: 1, order: 2, parentCode: 'NHOM-3' },
    { name: 'Tổ 12', code: 'TO-12', level: 1, order: 3, parentCode: 'NHOM-3' },
    { name: 'Tổ 13', code: 'TO-13', level: 1, order: 4, parentCode: 'NHOM-3' },
    { name: 'Tổ 14', code: 'TO-14', level: 1, order: 5, parentCode: 'NHOM-3' },
    { name: 'Tổ 15', code: 'TO-15', level: 1, order: 1, parentCode: 'NHOM-4' },
    { name: 'Tổ 16', code: 'TO-16', level: 1, order: 2, parentCode: 'NHOM-4' },
    { name: 'Tổ 17', code: 'TO-17', level: 1, order: 3, parentCode: 'NHOM-4' },
    { name: 'Tổ 18', code: 'TO-18', level: 1, order: 4, parentCode: 'NHOM-4' },
  ];

  for (const team of teams) {
    const parentId = createdGroups[team.parentCode];
    await prisma.team.upsert({
      where: { code: team.code },
      update: {},
      create: {
        name: team.name,
        code: team.code,
        level: team.level,
        order: team.order,
        parentId,
      },
    });
    console.log(`Team created: ${team.name} (${team.code}) -> ${team.parentCode}`);
  }

  // ── Sample Wards (Phường - level 2) ─────────────────────────────────────────
  const wards = [
    { name: 'Phường Bến Nghé', code: 'P-BN', level: 2, order: 1, parentCode: 'TO-01' },
    { name: 'Phường Bến Thành', code: 'P-BT', level: 2, order: 2, parentCode: 'TO-01' },
    { name: 'Phường Cầu Kho', code: 'P-CK', level: 2, order: 1, parentCode: 'TO-02' },
    { name: 'Phường Nguyễn Cư Trinh', code: 'P-NCT', level: 2, order: 2, parentCode: 'TO-02' },
    { name: 'Phường Phạm Ngũ Lão', code: 'P-PNL', level: 2, order: 1, parentCode: 'TO-03' },
    { name: 'Phường Cô Giang', code: 'P-CG', level: 2, order: 2, parentCode: 'TO-03' },
  ];

  for (const ward of wards) {
    // Find parent team
    const parent = await prisma.team.findUnique({ where: { code: ward.parentCode } });
    if (parent) {
      await prisma.team.upsert({
        where: { code: ward.code },
        update: {},
        create: {
          name: ward.name,
          code: ward.code,
          level: ward.level,
          order: ward.order,
          parentId: parent.id,
        },
      });
      console.log(`Ward created: ${ward.name} (${ward.code}) -> ${ward.parentCode}`);
    }
  }

  // ── Team permissions ────────────────────────────────────────────────────────
  const teamPerms = [
    { action: 'read', subject: 'Team' },
    { action: 'write', subject: 'Team' },
    { action: 'edit', subject: 'Team' },
    { action: 'delete', subject: 'Team' },
  ];

  const createdPerms: Array<{ id: string; action: string; subject: string }> = [];
  for (const perm of teamPerms) {
    const p = await prisma.permission.upsert({
      where: { action_subject: perm },
      update: {},
      create: perm,
    });
    createdPerms.push(p);
    console.log(`Permission created: ${perm.action}:${perm.subject}`);
  }

  // Assign to ADMIN role
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (adminRole) {
    for (const perm of createdPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: perm.id },
      });
    }
    console.log('Team permissions assigned to ADMIN role');
  }

  // Assign to OFFICER role
  const officerRole = await prisma.role.findUnique({ where: { name: 'OFFICER' } });
  if (officerRole) {
    for (const perm of createdPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: officerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: officerRole.id, permissionId: perm.id },
      });
    }
    console.log('Team permissions assigned to OFFICER role');
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
