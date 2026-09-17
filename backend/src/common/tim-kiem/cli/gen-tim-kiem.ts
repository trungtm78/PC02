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
import { sinhFrontendBoDau } from '../bo-dau';
import { KHAI_TIM_KIEM } from '../khai';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  sinhSqlBatLaiTimKiem,
  sinhSqlTatTimKiem,
  truongPrismaCanCo,
  type KhaiThucThe,
} from '../sinh/sinh-tim-kiem';
import {
  TEP_FRONTEND,
  TEP_FRONTEND_BO_DAU,
  TEP_SCHEMA,
  TEP_SQL_BAT_LAI,
  TEP_SQL_TAT,
  THU_MUC_MIGRATION,
  thuMucMigrationTimKiemMoiNhat,
  truongPrismaThieu,
} from '../sinh/tep-sinh';

export function dauThoiGian(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface DuongDanGen {
  thuMucMigration: string;
  tepFrontend: string;
  /** Bảng bỏ dấu cho trình duyệt — cùng bảng với máy chủ. */
  tepFrontendBoDau: string;
  tepSchema: string;
  /** SQL vận hành khẩn: tắt / bật lại trigger tìm kiếm. */
  tepSqlTat: string;
  tepSqlBatLai: string;
}

const DUONG_DAN_THAT: DuongDanGen = {
  thuMucMigration: THU_MUC_MIGRATION,
  tepFrontend: TEP_FRONTEND,
  tepFrontendBoDau: TEP_FRONTEND_BO_DAU,
  tepSchema: TEP_SCHEMA,
  tepSqlTat: TEP_SQL_TAT,
  tepSqlBatLai: TEP_SQL_BAT_LAI,
};

/**
 * Thân lệnh — nhận đường dẫn và danh sách khai qua tham số để ca kiểm chạy trên thư mục tạm,
 * không ghi đè tệp thật của kho mã.
 *
 * @returns mã thoát: 0 xong · 1 schema.prisma thiếu field · 2 tham số sai / chưa có migration
 */
export function chayGenTimKiem(
  argv: readonly string[],
  duongDan: DuongDanGen = DUONG_DAN_THAT,
  khais: readonly KhaiThucThe[] = KHAI_TIM_KIEM,
  bayGio: Date = new Date(),
): number {
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
    thuMuc = `${dauThoiGian(bayGio)}_tim_kiem_${ten}`;
  } else {
    thuMuc = thuMucMigrationTimKiemMoiNhat(
      fs.readdirSync(duongDan.thuMucMigration),
    );
    if (!thuMuc) {
      console.error(
        'Chưa có migration tìm kiếm nào — chạy với --moi <ten> để tạo.',
      );
      return 2;
    }
  }

  const tepMigration = path.join(
    duongDan.thuMucMigration,
    thuMuc,
    'migration.sql',
  );
  fs.mkdirSync(path.dirname(tepMigration), { recursive: true });
  fs.writeFileSync(tepMigration, sinhMigrationTimKiem(khais), 'utf8');
  fs.mkdirSync(path.dirname(duongDan.tepFrontend), { recursive: true });
  fs.writeFileSync(duongDan.tepFrontend, sinhFrontendTimKiem(khais), 'utf8');
  fs.mkdirSync(path.dirname(duongDan.tepFrontendBoDau), { recursive: true });
  fs.writeFileSync(duongDan.tepFrontendBoDau, sinhFrontendBoDau(), 'utf8');
  fs.mkdirSync(path.dirname(duongDan.tepSqlTat), { recursive: true });
  fs.writeFileSync(duongDan.tepSqlTat, sinhSqlTatTimKiem(khais), 'utf8');
  fs.mkdirSync(path.dirname(duongDan.tepSqlBatLai), { recursive: true });
  fs.writeFileSync(duongDan.tepSqlBatLai, sinhSqlBatLaiTimKiem(khais), 'utf8');
  console.log(`Đã ghi ${tepMigration}`);
  console.log(`Đã ghi ${duongDan.tepFrontend}`);
  console.log(`Đã ghi ${duongDan.tepFrontendBoDau}`);
  console.log(`Đã ghi ${duongDan.tepSqlTat}`);
  console.log(`Đã ghi ${duongDan.tepSqlBatLai}`);

  const thieu = truongPrismaThieu(
    fs.readFileSync(duongDan.tepSchema, 'utf8'),
    truongPrismaCanCo(khais),
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
  process.exitCode = chayGenTimKiem(process.argv.slice(2));
}
