import * as fs from 'fs';
import * as path from 'path';
import { KHAI_TIM_KIEM } from './khai';
import {
  sinhFrontendTimKiem,
  sinhMigrationTimKiem,
  truongPrismaCanCo,
} from './sinh/sinh-tim-kiem';
import {
  TEP_FRONTEND,
  TEP_SCHEMA,
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
