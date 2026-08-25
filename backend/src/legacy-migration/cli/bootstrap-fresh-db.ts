/**
 * bootstrap-fresh-db.ts — dựng cơ sở dữ liệu TRỐNG cho một máy chủ mới.
 *
 * VÌ SAO CẦN: `prisma migrate deploy` KHÔNG dựng được cơ sở dữ liệu từ số không. Migration
 * đầu tiên của kho mã (`20260227000000_add_case_metadata`) chạy `ALTER TABLE "cases"` trong
 * khi không có migration nào TẠO bảng ấy — lịch sử migration bắt đầu từ giữa chừng, vì máy
 * đang chạy lớn lên dần chứ chưa bao giờ được dựng lại từ đầu.
 *
 * Hệ quả: máy đang chạy vẫn ổn, nhưng dựng máy chủ MỚI thì hỏng ngay bước đầu với
 * `relation "cases" does not exist`.
 *
 * CÁCH LÀM: dựng lược đồ thẳng từ `schema.prisma` (`prisma db push`), rồi ĐÁNH DẤU toàn bộ
 * migration là đã áp (`prisma migrate resolve --applied`). Sau bước này `migrate deploy`
 * hoạt động bình thường cho mọi migration về sau.
 *
 * KHÔNG đụng gì tới máy đang chạy — script từ chối chạy nếu cơ sở dữ liệu đã có bảng.
 *
 * Dùng: set -a && source .env && set +a
 *       ./node_modules/.bin/ts-node src/legacy-migration/cli/bootstrap-fresh-db.ts
 *       thêm --force nếu thật sự muốn chạy trên cơ sở dữ liệu đã có bảng (hiếm khi đúng).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const GOC = path.resolve(__dirname, '../../..');
const THU_MUC_MIGRATION = path.join(GOC, 'prisma', 'migrations');
const PRISMA_BIN = path.join(GOC, 'node_modules', 'prisma', 'build', 'index.js');

function chayPrisma(args: string[]): void {
  execFileSync(process.execPath, [PRISMA_BIN, ...args], { stdio: 'inherit', cwd: GOC });
}

/** Tên mọi thư mục migration, theo đúng thứ tự Prisma áp. */
export function danhSachMigration(thuMuc: string): string[] {
  return fs
    .readdirSync(thuMuc, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(thuMuc, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort();
}

async function daCoBang(): Promise<boolean> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n from information_schema.tables
       where table_schema = 'public' and table_name not like '_prisma%'`,
    );
    return (r[0]?.n ?? 0) > 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  if (!process.env['DATABASE_URL']) {
    console.error('Thiếu DATABASE_URL. Chạy: set -a && source .env && set +a');
    process.exit(1);
  }

  if ((await daCoBang()) && !force) {
    console.error(
      'Cơ sở dữ liệu ĐÃ CÓ bảng — script này chỉ dành cho cơ sở dữ liệu trống.\n' +
        'Máy đang chạy thì dùng `prisma migrate deploy` như bình thường.\n' +
        'Nếu thật sự muốn chạy ở đây, thêm --force.',
    );
    process.exit(1);
  }

  const ds = danhSachMigration(THU_MUC_MIGRATION);
  console.log(`Tìm thấy ${ds.length} migration.`);

  console.log('\n[1/2] Dựng lược đồ thẳng từ schema.prisma…');
  chayPrisma(['db', 'push', '--schema=prisma/schema.prisma', '--accept-data-loss']);

  console.log('\n[2/2] Đánh dấu toàn bộ migration là đã áp…');
  for (const ten of ds) {
    chayPrisma(['migrate', 'resolve', '--applied', ten, '--schema=prisma/schema.prisma']);
  }

  console.log('\nXONG. Kiểm lại bằng: prisma migrate status (phải báo không còn migration chờ).');
  console.log('Bước tiếp theo cho máy mới: npm run db:seed && npm run db:seed:features');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
