import { describe, expect, it } from 'vitest';
import { laNguonTrucTiep } from '../truc-tiep';
import corpus from '../truc-tiep.corpus.json';

/**
 * Cổng: bản TRÌNH DUYỆT phải cho đúng kết quả trên bộ tên chuẩn dùng chung.
 *
 * Bản MÁY CHỦ chấm chính nó trên CÙNG tệp ấy (`backend/src/common/utils/nguon-don.util.spec.ts`).
 * Hai bản lệch nhau là form cho Lưu còn máy chủ trả 400 — hoặc ngược lại, form chặn thứ máy
 * chủ nhận. Luật này quyết định nhóm định danh có bung không và SĐT có bắt buộc không.
 */
describe('laNguonTrucTiep (trình duyệt) — chấm trên bộ tên chuẩn dùng chung', () => {
  it('bộ tên chuẩn không rỗng — cổng quét 0 mẫu mà vẫn xanh là cổng vô nghĩa', () => {
    expect(corpus.truc_tiep.length).toBeGreaterThan(5);
    expect(corpus.khong_truc_tiep.length).toBeGreaterThan(5);
  });

  it.each(corpus.truc_tiep)('nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten)).toBe(true);
  });

  it.each(corpus.khong_truc_tiep)('KHÔNG nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten)).toBe(false);
  });

  it('null/undefined ra false, không nổ', () => {
    expect(laNguonTrucTiep(null)).toBe(false);
    expect(laNguonTrucTiep(undefined)).toBe(false);
  });
});
