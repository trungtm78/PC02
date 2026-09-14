/**
 * Bộ sinh tìm kiếm — ghi migration SQL + `frontend/src/shared/tim-kiem/generated.ts` từ tệp khai,
 * và kiểm `schema.prisma` đã khai đủ field cột bóng.
 *
 * Dùng (từ thư mục backend):
 *   npm run gen:tim-kiem                    # ghi lại migration tìm kiếm MỚI NHẤT (chưa áp lên prod)
 *   npm run gen:tim-kiem -- --moi <ten>     # khai đã đổi sau khi migration cũ lên prod → tạo migration mới
 *
 * Không tự sửa schema.prisma: field Prisma có chú thích nghiệp vụ viết tay — bộ sinh chỉ báo thiếu.
 */
import * as fs from 'fs';
import * as path from 'path';
import { KHAI_TIM_KIEM } from '../khai';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
} from '../sinh/sinh-tim-kiem';
import {
  TEP_FRONTEND,
  TEP_SCHEMA,
  THU_MUC_MIGRATION,
  thuMucMigrationTimKiemMoiNhat,
  truongPrismaThieu,
} from '../sinh/tep-sinh';

function dauThoiGian(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function main(argv: readonly string[]): number {
  const iMoi = argv.indexOf('--moi');
  let thuMuc: string | undefined;
  if (iMoi >= 0) {
    const ten = argv[iMoi + 1];
    if (!ten || !/^[a-z0-9_]+$/.test(ten)) {
      console.error(
        '--moi cần tên dạng chữ thường/số/gạch dưới, vd: --moi don_thu',
      );
      return 2;
    }
    thuMuc = `${dauThoiGian()}_tim_kiem_${ten}`;
  } else {
    thuMuc = thuMucMigrationTimKiemMoiNhat();
    if (!thuMuc) {
      console.error(
        'Chưa có migration tìm kiếm nào — chạy với --moi <ten> để tạo.',
      );
      return 2;
    }
  }

  const tepMigration = path.join(THU_MUC_MIGRATION, thuMuc, 'migration.sql');
  fs.mkdirSync(path.dirname(tepMigration), { recursive: true });
  fs.writeFileSync(tepMigration, sinhMigrationTimKiem(KHAI_TIM_KIEM), 'utf8');
  fs.mkdirSync(path.dirname(TEP_FRONTEND), { recursive: true });
  fs.writeFileSync(TEP_FRONTEND, sinhFrontendTimKiem(KHAI_TIM_KIEM), 'utf8');
  console.log(`Đã ghi ${path.relative(process.cwd(), tepMigration)}`);
  console.log(`Đã ghi ${path.relative(process.cwd(), TEP_FRONTEND)}`);

  const thieu = truongPrismaThieu(
    fs.readFileSync(TEP_SCHEMA, 'utf8'),
    truongPrismaCanCo(KHAI_TIM_KIEM),
  );
  if (thieu.length) {
    console.error(
      '\nschema.prisma còn thiếu field chỉ đọc (thêm tay, kèm chú thích):',
    );
    for (const t of thieu) {
      console.error(`  model ${t.model}:  ${t.field} String? @map("${t.cot}")`);
    }
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
