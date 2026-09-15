import * as fs from 'fs';
import * as path from 'path';
import { KHAI_TIM_KIEM } from './khai';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  sinhSqlBatLaiTimKiem,
  sinhSqlTatTimKiem,
  truongPrismaCanCo,
} from './sinh/sinh-tim-kiem';
import {
  cotDbLech,
  kieuCotLech,
  TEP_FRONTEND,
  TEP_SCHEMA,
  TEP_SQL_BAT_LAI,
  TEP_SQL_TAT,
  THU_MUC_MIGRATION,
  thuMucMigrationTimKiemMoiNhat,
  truongPrismaThieu,
} from './sinh/tep-sinh';

/**
 * CỔNG: ba sản phẩm của bộ sinh tìm kiếm phải khớp tệp khai.
 *
 * Khai một cột tìm được mà quên chạy `npm run gen:tim-kiem` thì: máy chủ dựng điều kiện trên cột
 * bóng không tồn tại (500), hoặc giao diện hiện thẻ cho cột máy chủ không nhận (400), hoặc trigger
 * không giữ cột bóng cho cột mới (thẻ trả thiếu kết quả, không ai biết). Cả ba đều không có ca kiểm
 * đơn vị nào thấy — chỉ so tệp đã commit với đầu ra bộ sinh mới bắt được.
 */
const docLF = (tep: string) =>
  fs.readFileSync(tep, 'utf8').replace(/\r\n/g, '\n');

describe('GATE tìm kiếm — tệp sinh khớp tệp khai', () => {
  it('có migration tìm kiếm', () => {
    expect(thuMucMigrationTimKiemMoiNhat()).toBeDefined();
  });

  it('migration tìm kiếm MỚI NHẤT ≡ đầu ra bộ sinh (quên chạy gen:tim-kiem là đỏ)', () => {
    const thuMuc = thuMucMigrationTimKiemMoiNhat() as string;
    expect(docLF(path.join(THU_MUC_MIGRATION, thuMuc, 'migration.sql'))).toBe(
      sinhMigrationTimKiem(KHAI_TIM_KIEM),
    );
  });

  it('frontend/src/shared/tim-kiem/generated.ts ≡ đầu ra bộ sinh', () => {
    expect(docLF(TEP_FRONTEND)).toBe(sinhFrontendTimKiem(KHAI_TIM_KIEM));
  });

  /**
   * SQL vận hành khẩn nằm trong docs/van-hanh để chạy tay trên prod lúc sự cố. Khai thêm cột mà tệp
   * không sinh lại thì bản "tắt" bỏ sót cột bóng mới — đúng lúc cần nó nhất.
   */
  it('docs/van-hanh/tat-trigger-tim-kiem.sql ≡ đầu ra bộ sinh', () => {
    expect(docLF(TEP_SQL_TAT)).toBe(sinhSqlTatTimKiem(KHAI_TIM_KIEM));
  });

  it('docs/van-hanh/bat-lai-trigger-tim-kiem.sql ≡ đầu ra bộ sinh', () => {
    expect(docLF(TEP_SQL_BAT_LAI)).toBe(sinhSqlBatLaiTimKiem(KHAI_TIM_KIEM));
  });

  /** Trigger gọi tên cột thật — khai lệch `@map` thì migration dừng giữa deploy. */
  it('tên cột trong khai khớp @map của schema.prisma', () => {
    expect(cotDbLech(docLF(TEP_SCHEMA), KHAI_TIM_KIEM)).toEqual([]);
  });

  /**
   * Bộ lọc Prisma khác nhau theo kiểu cột (BoolFilter không có `in`, `mode` chỉ ở String) — khai lệch
   * kiểu là 500 lúc lọc mà ca kiểm hình đối tượng vẫn xanh (lỗi thẻ Trạng thái M6).
   */
  it('kiểu thẻ khai hợp kiểu cột schema.prisma', () => {
    expect(kieuCotLech(docLF(TEP_SCHEMA), KHAI_TIM_KIEM)).toEqual([]);
  });

  it('schema.prisma khai đủ field chỉ đọc cho mọi cột bóng', () => {
    expect(
      truongPrismaThieu(docLF(TEP_SCHEMA), truongPrismaCanCo(KHAI_TIM_KIEM)),
    ).toEqual([]);
  });

  /** Gieo lỗi: cổng phải thật sự đỏ khi lệch — một cổng không bao giờ đỏ là cổng chết. */
  it('gieo lỗi: đổi khai hoặc bỏ field thì phép so không còn khớp', () => {
    const [dau, ...con] = KHAI_TIM_KIEM;
    const khaiThemCot = [
      {
        ...dau,
        truong: [
          ...dau.truong,
          {
            key: 'gieoLoi',
            nhan: 'Gieo lỗi',
            kieu: 'chu' as const,
            cot: 'notes',
          },
        ],
      },
      ...con,
    ];
    expect(sinhMigrationTimKiem(khaiThemCot)).not.toBe(
      sinhMigrationTimKiem(KHAI_TIM_KIEM),
    );
    expect(sinhFrontendTimKiem(khaiThemCot)).not.toBe(
      sinhFrontendTimKiem(KHAI_TIM_KIEM),
    );
    expect(
      truongPrismaThieu(docLF(TEP_SCHEMA), truongPrismaCanCo(khaiThemCot)),
    ).toEqual([{ model: dau.model, field: 'notesBd', cot: 'notes_bd' }]);
  });
});
