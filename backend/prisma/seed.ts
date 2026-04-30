/**
 * Prisma Seed Script
 * Creates initial admin role, permissions, and an admin user for dev/testing.
 * Run: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { seedFeatureFlags } from './seed-feature-flags';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Roles ──────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System administrator with full access',
    },
  });

  const officerRole = await prisma.role.upsert({
    where: { name: 'OFFICER' },
    update: {},
    create: {
      name: 'OFFICER',
      description: 'Case officer - read/write own cases',
    },
  });

  console.log('Roles created:', adminRole.name, officerRole.name);

  // ── Permissions ────────────────────────────────────────────────────────────
  const permissions = [
    { action: 'read', subject: 'User' },
    { action: 'write', subject: 'User' },
    { action: 'delete', subject: 'User' },
    { action: 'read', subject: 'AuditLog' },
    { action: 'read', subject: 'Case' },
    { action: 'write', subject: 'Case' },
    { action: 'edit', subject: 'Case' },
    { action: 'delete', subject: 'Case' },
    // Directory permissions
    { action: 'read', subject: 'Directory' },
    { action: 'write', subject: 'Directory' },
    { action: 'delete', subject: 'Directory' },
    // Role/permission management
    { action: 'read', subject: 'Role' },
    { action: 'write', subject: 'Role' },
    { action: 'delete', subject: 'Role' },
    // Document permissions (TASK-2026-022601)
    { action: 'read', subject: 'Document' },
    { action: 'write', subject: 'Document' },
    { action: 'edit', subject: 'Document' },
    { action: 'delete', subject: 'Document' },
    // Subject permissions (Bị can / Bị hại / Nhân chứng)
    { action: 'read', subject: 'Subject' },
    { action: 'write', subject: 'Subject' },
    { action: 'edit', subject: 'Subject' },
    { action: 'delete', subject: 'Subject' },
    // Petition permissions (Đơn thư)
    { action: 'read', subject: 'Petition' },
    { action: 'write', subject: 'Petition' },
    { action: 'edit', subject: 'Petition' },
    { action: 'delete', subject: 'Petition' },
    // Incident permissions (Vụ việc)
    { action: 'read', subject: 'Incident' },
    { action: 'write', subject: 'Incident' },
    { action: 'edit', subject: 'Incident' },
    { action: 'delete', subject: 'Incident' },
    // Lawyer permissions (Luật sư)
    { action: 'read', subject: 'Lawyer' },
    { action: 'write', subject: 'Lawyer' },
    { action: 'edit', subject: 'Lawyer' },
    { action: 'delete', subject: 'Lawyer' },
    // Team permissions — needed for dispatcher to read teams when assigning
    { action: 'read', subject: 'Team' },
    { action: 'write', subject: 'Team' },
    { action: 'edit', subject: 'Team' },
    { action: 'delete', subject: 'Team' },
    // Report permissions — TĐC báo cáo
    { action: 'read', subject: 'Report', description: 'Xem báo cáo TĐC' },
    { action: 'write', subject: 'Report', description: 'Tạo và điều chỉnh báo cáo TĐC' },
    { action: 'approve', subject: 'Report', description: 'Phê duyệt và khóa báo cáo TĐC' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { action_subject: { action: perm.action, subject: perm.subject } },
      update: {},
      create: perm,
    });
  }

  // ── Assign all permissions to ADMIN role ───────────────────────────────────
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // ── Grant OFFICER role: read permissions needed for dispatcher workflow ────
  const officerReadPerms = await prisma.permission.findMany({
    where: {
      action: 'read',
      subject: { in: ['Team', 'User', 'Case', 'Petition', 'Incident'] },
    },
  });
  for (const perm of officerReadPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: officerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: officerRole.id, permissionId: perm.id },
    });
  }

  // ── Seed admin user ────────────────────────────────────────────────────────
  // Password MUST come from env var (never hardcoded)
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawAdminPassword || rawAdminPassword.length < 8) {
    console.error('\nERROR: SEED_ADMIN_PASSWORD env var required (min 8 chars).');
    console.error('Set it in backend/.env or shell before running this seed.\n');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(rawAdminPassword, 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pc02.local' },
    // Keep passwordHash + isActive in sync with env on every seed run.
    // Without this, rotating SEED_ADMIN_PASSWORD silently leaves the old
    // hash in the DB and login starts failing with no obvious signal.
    update: { passwordHash, isActive: true },
    create: {
      email: 'admin@pc02.local',
      username: 'admin',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log('Admin user created:', adminUser.email);

  // ── Seed: Sample Directory entries for Crime (needed for Subject.crimeId FK) ─
  const crimeDir = await prisma.directory.upsert({
    where: { type_code: { type: 'CRIME', code: 'DIEU-173' } },
    update: {},
    create: {
      type: 'CRIME',
      code: 'DIEU-173',
      name: 'Trộm cắp tài sản (Điều 173 BLHS)',
    },
  }).catch((e) => { console.warn('Crime directory upsert skipped:', e.message); return null; });

  // ── Seed: Sample Case ──────────────────────────────────────────────────────
  // Find existing seed case or create one
  let sampleCase = await prisma.case.findFirst({
    where: { name: 'Vụ án trộm cắp tài sản tại Quận 1 (Seed)' },
  });

  if (!sampleCase) {
    sampleCase = await prisma.case.create({
      data: {
        name: 'Vụ án trộm cắp tài sản tại Quận 1 (Seed)',
        crime: 'Trộm cắp tài sản',
        status: 'DANG_DIEU_TRA',
        unit: 'Công an Quận 1',
        deadline: new Date('2026-06-01'),
        investigatorId: adminUser.id,
      },
    }).catch((e) => { console.warn('Case create skipped:', e.message); return null; });
  }

  if (sampleCase && crimeDir) {
    console.log('Sample case:', sampleCase.id);

    // ── Seed: Victim subject (AC-01) ────────────────────────────────────────
    const existingVictim = await prisma.subject.findFirst({
      where: { idNumber: 'SEED-VICTIM-001', caseId: sampleCase.id },
    });
    if (!existingVictim) {
      const victim = await prisma.subject.create({
        data: {
          fullName: 'Trần Thị Hoa (Seed Nạn nhân)',
          dateOfBirth: new Date('1990-05-15'),
          gender: 'FEMALE',
          idNumber: 'SEED-VICTIM-001',
          address: '45 Đường Lê Lợi, Quận 1, TP.HCM',
          phone: '0912000001',
          type: 'VICTIM',
          status: 'INVESTIGATING',
          caseId: sampleCase.id,
          crimeId: crimeDir.id,
        },
      }).catch((e) => { console.warn('Victim create skipped:', e.message); return null; });
      if (victim) console.log('Seed victim created:', victim.fullName);
    } else {
      console.log('Seed victim already exists, skipped.');
    }

    // ── Seed: Lawyer linked to case (AC-02) ─────────────────────────────────
    const existingLawyer = await prisma.lawyer.findFirst({
      where: { barNumber: 'LS-SEED-HCM-001' },
    });
    if (!existingLawyer) {
      const lawyer = await prisma.lawyer.create({
        data: {
          fullName: 'Luật sư Nguyễn Văn Bình (Seed)',
          barNumber: 'LS-SEED-HCM-001',
          lawFirm: 'Văn phòng Luật sư Công Lý TP.HCM',
          phone: '0901000001',
          caseId: sampleCase.id,
        },
      }).catch((e) => { console.warn('Lawyer create skipped:', e.message); return null; });
      if (lawyer) console.log('Seed lawyer created:', lawyer.fullName);
    } else {
      console.log('Seed lawyer already exists, skipped.');
    }
  }

  // ── Feature flags (always seeded, idempotent) ─────────────────────────────
  // Critical: without these rows the frontend /feature-flags endpoint returns
  // an empty list and every sidebar menu disappears on a fresh deploy.
  const seededFlags = await seedFeatureFlags(prisma);
  console.log(`Seed feature flags: ${seededFlags} entries upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
