import { KHAI_TIM_KIEM } from '../khai';
import {
  sinhMigrationTimKiem,
  sinhSqlBatLaiTimKiem,
  sinhSqlTatTimKiem,
} from './sinh-tim-kiem';

/**
 * SQL vận hành khẩn cho trigger tìm kiếm — sinh từ CÙNG tệp khai với migration, để tên hàm và danh
 * sách cột bóng không lệch khỏi thứ đang chạy trên CSDL (chép tay thì lệch ngay lần khai thêm cột).
 */
describe('sinhSqlTatTimKiem', () => {
  const tat = sinhSqlTatTimKiem(KHAI_TIM_KIEM);

  it('thay thân MỌI hàm trigger bằng bản đặt cột bóng NULL', () => {
    expect(tat).toContain(
      'CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_petitions() RETURNS trigger',
    );
    expect(tat).toContain(
      'CREATE OR REPLACE FUNCTION pc02_dat_tim_kiem_users() RETURNS trigger',
    );
    for (const cot of [
      'nguon_don_bd',
      'sender_name_bd',
      'detail_content_bd',
      'tim_kiem_bd',
      'ho_ten_bd',
    ]) {
      expect(tat).toContain(`NEW."${cot}" := NULL;`);
    }
  });

  /** Sự cố thường nằm ở chính `f_bo_dau` — bản tắt không được gọi lại nó. */
  it('không gọi f_bo_dau', () => {
    expect(tat).not.toMatch(/f_bo_dau\(/);
  });

  /**
   * Chạy trên prod lúc có sự cố: không được đụng dữ liệu hay cấu trúc. Cột bóng NULL thì thẻ lùi về
   * cột gốc — kết quả vẫn đúng, chỉ chậm hơn; gỡ trigger thì cột bóng cũ nằm lại và trả sai.
   */
  it('không DROP / ALTER / UPDATE / DELETE / TRUNCATE', () => {
    const lenh = tat
      .split('\n')
      .filter((d) => !d.trimStart().startsWith('--'))
      .join('\n');
    expect(lenh).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i);
  });

  it('chỉ dẫn cách bật lại', () => {
    expect(tat).toContain('bat-lai-trigger-tim-kiem.sql');
    expect(tat).toContain('TIM_KIEM_THE');
  });
});

describe('sinhSqlBatLaiTimKiem', () => {
  const bat = sinhSqlBatLaiTimKiem(KHAI_TIM_KIEM);
  const migration = sinhMigrationTimKiem(KHAI_TIM_KIEM);

  it('mọi khối hàm trùng NGUYÊN VĂN khối trong migration', () => {
    // f_bo_dau đóng bằng `$f$;`, hàm trigger bằng `$$;`.
    const khoi = bat.match(/CREATE OR REPLACE FUNCTION [\s\S]*?\$f?\$;/g) ?? [];
    // f_bo_dau + users + petitions
    expect(khoi.length).toBe(3);
    for (const k of khoi) expect(migration).toContain(k);
  });

  it('không DROP / ALTER / UPDATE / DELETE / TRUNCATE', () => {
    const lenh = bat
      .split('\n')
      .filter((d) => !d.trimStart().startsWith('--'))
      .join('\n');
    expect(lenh).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i);
  });

  it('nhắc nạp lại cột bóng cho dòng đã sửa trong lúc tắt', () => {
    expect(bat).toContain('nap-cot-bong-tim-kiem');
  });
});
