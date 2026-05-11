/**
 * Prisma Seed Script
 * Creates initial admin role, permissions, and an admin user for dev/testing.
 * Run: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { seedFeatureFlags } from './seed-feature-flags';
import { seedWards } from './seed-wards';
import { seedDirectoryTypes } from './seed-directory-types';
import { seedMasterClasses } from './seed-master-classes';
import { seedDeadlineRules } from './seed-deadline-rules';

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
    // DeadlineRuleVersion — versioning workflow for legal deadlines
    { action: 'read', subject: 'DeadlineRuleVersion', description: 'Xem quy tắc thời hạn xử lý' },
    { action: 'write', subject: 'DeadlineRuleVersion', description: 'Đề xuất sửa quy tắc thời hạn (maker)' },
    { action: 'approve', subject: 'DeadlineRuleVersion', description: 'Duyệt và kích hoạt quy tắc thời hạn (checker)' },
    // Withdraw + request-changes — symmetric maker/checker recall workflow.
    // If new roles ever propose deadline rules, they MUST also get withdraw_own.
    { action: 'withdraw_own', subject: 'DeadlineRuleVersion', description: 'Thu hồi đề xuất quy tắc của chính mình (maker)' },
    { action: 'request_changes', subject: 'DeadlineRuleVersion', description: 'Yêu cầu sửa đổi đề xuất quy tắc (checker)' },
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
      subject: { in: ['Team', 'User', 'Case', 'Petition', 'Incident', 'DeadlineRuleVersion'] },
    },
  });
  for (const perm of officerReadPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: officerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: officerRole.id, permissionId: perm.id },
    });
  }

  // ── DEADLINE_APPROVER role: separation-of-duties checker for legal rules ───
  const deadlineApproverRole = await prisma.role.upsert({
    where: { name: 'DEADLINE_APPROVER' },
    update: {},
    create: {
      name: 'DEADLINE_APPROVER',
      description: 'Người duyệt quy tắc thời hạn xử lý (legal compliance approver)',
    },
  });
  const approverPerms = await prisma.permission.findMany({
    where: { subject: 'DeadlineRuleVersion', action: { in: ['read', 'approve', 'request_changes'] } },
  });
  for (const perm of approverPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: deadlineApproverRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: deadlineApproverRole.id, permissionId: perm.id },
    });
  }
  console.log('Role created:', deadlineApproverRole.name);

  // ── Seed initial DeadlineRuleVersion rows (idempotent) ─────────────────────
  const deadlineSeedResult = await seedDeadlineRules(prisma);
  console.log(`DeadlineRules seeded: ${deadlineSeedResult.created} created, ${deadlineSeedResult.skipped} skipped`);

  // ── Seed admin user ────────────────────────────────────────────────────────
  // Password MUST come from env var (never hardcoded)
  const rawAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!rawAdminPassword || rawAdminPassword.length < 8) {
    console.error('\nERROR: SEED_ADMIN_PASSWORD env var required (min 8 chars).');
    console.error('Set it in backend/.env or shell before running this seed.\n');
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(rawAdminPassword, 12);
  // Use find+create/update instead of upsert to avoid Prisma adapter P2011 issue
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@pc02.local' } });
  const adminUser = existingAdmin
    ? await prisma.user.update({
        where: { email: 'admin@pc02.local' },
        data: { passwordHash, isActive: true, roleId: adminRole.id },
      })
    : await prisma.user.create({
        data: {
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

  // ── Seed: Sample Directory entry for Crime (needed for Subject.crimeId FK) ───
  // seedDirectoryTypes() adds full BLHS crime list — this just ensures D173 exists
  // for the sample Case/Subject data below
  const crimeDir = await prisma.directory.upsert({
    where: { type_code: { type: 'CRIME', code: 'D173' } },
    update: {},
    create: {
      type: 'CRIME',
      code: 'D173',
      name: 'Trộm cắp tài sản (Điều 173)',
      order: 23,
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

  // ── Directory types (PROVINCE, INCIDENT_TYPE, PETITION_TYPE, v.v.) ──────────
  // Critical: without this, form dropdowns show empty and Danh mục has no types.
  console.log('Seeding directory types...');
  await seedDirectoryTypes(prisma);

  // ── Master classes (categories for form dropdowns: crime types, VKS, etc.) ───
  console.log('Seeding master classes...');
  const masterCount = await seedMasterClasses(prisma);
  console.log(`Seed master classes: ${masterCount} entries upserted.`);

  // ── Feature flags (always seeded, idempotent) ─────────────────────────────
  // Critical: without these rows the frontend /feature-flags endpoint returns
  // an empty list and every sidebar menu disappears on a fresh deploy.
  const seededFlags = await seedFeatureFlags(prisma);
  console.log(`Seed feature flags: ${seededFlags} entries upserted.`);

  // ── Wards — 10,051 phường/xã toàn quốc (idempotent upsert) ───────────────
  console.log('Seeding wards (may take ~2-3 min for 10,051 entries)...');
  await seedWards(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
