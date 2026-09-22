/**
 * Seed HẸP: bảng `permissions` + cấp trọn quyền cho vai ADMIN.
 *
 * Chạy mỗi lần deploy. `prisma/seed.ts` (bộ seed đầy đủ) KHÔNG chạy khi deploy và không nên
 * chạy — nó còn tạo vai, người dùng mẫu và dữ liệu khởi tạo khác.
 *
 * Nhưng thiếu một dòng `permissions` thì `@RequirePermissions` trả 403 cho MỌI vai, kể cả
 * ADMIN: `seed.ts` cấp quyền cho ADMIN bằng `findMany()` trên những dòng chưa tồn tại. Chính
 * tệp `seed-permissions.ts` ghi lại tiền lệ ấy (ISSUE-001: thiếu `Setting`, hỏng /admin/settings
 * cho mọi vai).
 *
 * Ship một tính năng kèm quyền mới mà không seed quyền = tính năng chết ngay khi lên máy thật,
 * và chết bằng 403 chứ không bằng lỗi nào đọc được.
 *
 * Idempotent: `upsert` theo (action, subject) và theo (roleId, permissionId). Chỉ THÊM, không
 * bao giờ gỡ quyền của ai.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SEED_PERMISSIONS } from './seed-permissions';

export async function seedQuyen(prisma: PrismaClient): Promise<void> {
  let them = 0;
  for (const q of SEED_PERMISSIONS) {
    const truoc = await prisma.permission.findUnique({
      where: { action_subject: { action: q.action, subject: q.subject } },
      select: { id: true },
    });
    await prisma.permission.upsert({
      where: { action_subject: { action: q.action, subject: q.subject } },
      update: {},
      create: q,
      select: { id: true },
    });
    if (!truoc) them++;
  }

  const admin = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
    select: { id: true },
  });
  let capThem = 0;
  if (admin) {
    const tatCa = await prisma.permission.findMany({ select: { id: true } });
    for (const q of tatCa) {
      const co = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: admin.id, permissionId: q.id } },
        select: { roleId: true },
      });
      if (co) continue;
      await prisma.rolePermission.create({
        data: { roleId: admin.id, permissionId: q.id },
        select: { roleId: true },
      });
      capThem++;
    }
  }

  console.log(
    `[seed-quyen] ${SEED_PERMISSIONS.length} quyền khai, thêm mới ${them}; cấp thêm cho ADMIN ${capThem}.`,
  );
}

if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const client = new PrismaClient({ adapter });
  seedQuyen(client)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => void client.$disconnect());
}
