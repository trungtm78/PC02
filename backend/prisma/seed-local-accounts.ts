/**
 * Seed: Local development accounts
 * Idempotent — upsert an toàn, rerun không gây lỗi.
 * Run: npx ts-node prisma/seed-local-accounts.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString:
    process.env['DATABASE_URL'] ??
    'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

interface AccountSpec {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  workId: string;
  password: string;
  roleId: string;
}

/**
 * Mật khẩu tài khoản cục bộ lấy từ biến môi trường SEED_MAT_KHAU_<TÀI KHOẢN> — KHÔNG viết cứng. 20/09/2026: mật khẩu
 * viết cứng ở đây (và 23 tệp kiểm thử) lộ qua repo PUBLIC; 5 tài khoản cùng tên trên prod đã bị khoá.
 */
function matKhauTuMoiTruong(khoa: string): string {
  const v = process.env[`SEED_MAT_KHAU_${khoa}`];
  if (!v) throw new Error(`Thiếu biến môi trường SEED_MAT_KHAU_${khoa}`);
  return v;
}

/** Seed này upsert mật khẩu — chạy nhầm lên prod là đặt lại mật khẩu tài khoản đã khoá. Chỉ cho CSDL máy cục bộ. */
function chanCsdlKhongPhaiCucBo(): void {
  const url = process.env['DATABASE_URL'] ?? '';
  const host = /@([^:/?]+)/.exec(url)?.[1] ?? 'localhost';
  if (
    process.env['NODE_ENV'] === 'production' ||
    !['localhost', '127.0.0.1'].includes(host)
  ) {
    throw new Error(
      `seed-local-accounts chỉ chạy trên CSDL máy cục bộ (host hiện tại: ${host})`,
    );
  }
}

async function main() {
  chanCsdlKhongPhaiCucBo();
  const ADMIN_ROLE = 'cmm20w6rs0000ykm7974xz3ja';
  const OFFICER_ROLE = 'cmm20w6s20001ykm7cp76cwdw';
  const APPROVER_ROLE = 'role_deadline_approver';

  const accounts: AccountSpec[] = [
    {
      email: 'admin@pc02.local',
      username: 'admin',
      firstName: 'Super',
      lastName: 'Admin',
      workId: 'PC02-ADMIN-001',
      password: matKhauTuMoiTruong('ADMIN'),
      roleId: ADMIN_ROLE,
    },
    {
      email: 'admin2@pc02.local',
      username: 'admin2',
      firstName: 'Admin',
      lastName: 'Hai',
      workId: 'PC02-ADMIN-002',
      password: matKhauTuMoiTruong('ADMIN2'),
      roleId: ADMIN_ROLE,
    },
    {
      email: 'officer1@pc02.local',
      username: 'officer1',
      firstName: 'Điều Tra',
      lastName: 'Viên 1',
      workId: 'PC02-OFC-001',
      password: matKhauTuMoiTruong('OFFICER1'),
      roleId: OFFICER_ROLE,
    },
    {
      email: 'officer2@pc02.local',
      username: 'officer2',
      firstName: 'Điều Tra',
      lastName: 'Viên 2',
      workId: 'PC02-OFC-002',
      password: matKhauTuMoiTruong('OFFICER2'),
      roleId: OFFICER_ROLE,
    },
    {
      email: 'approver1@pc02.local',
      username: 'approver1',
      firstName: 'Phê Duyệt',
      lastName: 'Viên 1',
      workId: 'PC02-APV-001',
      password: matKhauTuMoiTruong('APPROVER1'),
      roleId: APPROVER_ROLE,
    },
  ];

  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, 12);
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        passwordHash,
        roleId: acc.roleId,
        isActive: true,
        twoFaSetupRequired: false,
        mustChangePassword: false,
        tokenVersion: 0,
      },
      create: {
        email: acc.email,
        username: acc.username,
        firstName: acc.firstName,
        lastName: acc.lastName,
        workId: acc.workId,
        passwordHash,
        roleId: acc.roleId,
        isActive: true,
        twoFaSetupRequired: false,
        mustChangePassword: false,
        tokenVersion: 0,
        backupCodes: [],
        backupCodeSalts: [],
      },
    });
    console.log(`✓ ${user.email} (${acc.roleId === ADMIN_ROLE ? 'ADMIN' : acc.roleId === OFFICER_ROLE ? 'OFFICER' : 'DEADLINE_APPROVER'})`);
  }

  console.log('\nDone — 5 local accounts ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
