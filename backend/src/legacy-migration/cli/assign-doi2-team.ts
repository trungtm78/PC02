/**
 * assign-doi2-team.ts — gán Tổ cho 12 tài khoản cấp theo file "TK to 2.xlsx" (2026-08-24).
 *
 * VÌ SAO CẦN: lượt cấp tài khoản trước tạo/đổi tên 12 người nhưng KHÔNG gán Tổ/Nhóm nào.
 * Hệ thống lọc dữ liệu theo tổ: người không thuộc tổ nào chỉ thấy hồ sơ do CHÍNH MÌNH
 * nhập (`scope-filter.util.ts` — nhánh `enteredById`), mà 12 người này chưa nhập gì.
 * Kết quả: mở màn hình nào cũng ra danh sách rỗng.
 *
 * Anh đã chốt: 12 người thuộc **Tổ CT số 2** (`team_ct02_pc02`).
 *
 * Đo trước trên bản chạy — sau khi gán, mỗi người thấy:
 *   - 711 đơn thư + 52 vụ án của Tổ CT số 2
 *   - 10.365 đơn thư chưa gán tổ (kho tiếp nhận chung; nhánh `assignedTeamId: null` của
 *     bộ lọc CHỈ chạy khi người dùng có tổ — hành vi sẵn có, không phải do script này thêm)
 *
 * MẶC ĐỊNH CHỈ ĐỌC. Chỉ khi có `--apply` mới ghi.
 *
 * Dùng: set -a && source .env && set +a
 *       ./node_modules/.bin/ts-node src/legacy-migration/cli/assign-doi2-team.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TEAM_ID = 'team_ct02_pc02';
const USERNAME_SUFFIX = '.doi2';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  try {
    const team = await prisma.team.findUnique({ where: { id: TEAM_ID } });
    if (!team) {
      console.error(`❌ Không tìm thấy Tổ "${TEAM_ID}" — dừng, không ghi gì.`);
      process.exit(1);
    }

    const users = await prisma.user.findMany({
      where: { username: { endsWith: USERNAME_SUFFIX } },
      select: { id: true, username: true, firstName: true, lastName: true },
      orderBy: { username: 'asc' },
    });

    console.log(`\n=== Gán Tổ cho tài khoản "${USERNAME_SUFFIX}" — chế độ: ${apply ? 'APPLY' : 'CHỈ ĐỌC'} ===`);
    console.log(`Tổ đích: ${team.name} (${team.id})`);
    console.log(`Tìm thấy ${users.length} tài khoản.\n`);

    if (users.length === 0) {
      console.error('❌ Không có tài khoản nào khớp — dừng.');
      process.exit(1);
    }

    let added = 0;
    let already = 0;

    for (const u of users) {
      const existing = await prisma.userTeam.findUnique({
        where: { userId_teamId: { userId: u.id, teamId: TEAM_ID } },
      });

      if (existing) {
        already++;
        console.log(`${u.username.padEnd(26)} — đã thuộc tổ này rồi, bỏ qua`);
        continue;
      }

      if (apply) {
        // isLeader = false: script này chỉ gán thành viên. Chức vụ Phó Đội trưởng
        // (Hoàng Công Tùng, Nguyễn Sỹ Khánh) là việc của người có thẩm quyền đặt,
        // không suy đoán từ file Excel.
        await prisma.userTeam.create({
          data: { userId: u.id, teamId: TEAM_ID, isLeader: false },
        });
        added++;
        console.log(`${u.username.padEnd(26)} ✅ đã gán vào "${team.name}"`);
      } else {
        added++;
        console.log(`${u.username.padEnd(26)} [dự kiến] gán vào "${team.name}"`);
      }
    }

    console.log(`\n--- Tổng kết ---`);
    console.log(`${apply ? 'Đã gán' : 'Sẽ gán'}: ${added} · Đã có sẵn: ${already}`);

    if (apply) {
      const total = await prisma.userTeam.count({ where: { teamId: TEAM_ID } });
      console.log(`Tổng thành viên "${team.name}" sau khi gán: ${total}`);
    } else {
      console.log('\n(Chế độ CHỈ ĐỌC — không có gì bị ghi. Chạy lại với --apply để thực thi.)');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
