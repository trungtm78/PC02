import * as fs from 'fs';
import * as path from 'path';
import {
  dungDanhMuc,
  docBoCuc,
  docAnhXaCot,
  docOBo,
} from '../../scripts/gen-khai-xuat-day-du';
import { TRUONG_FORM_DON_THU } from './khai-truong-form-don-thu.generated';

/**
 * CỔNG: bản SINH phải khớp nguồn. Đổi bố cục form mà quên chạy lại bộ sinh là đỏ.
 *
 * Không có cổng này thì bố cục thêm một ô mới, tệp xuất "đầy đủ" thiếu đúng ô ấy, và không dấu
 * hiệu nào hiện ra — tệp vẫn ra, vẫn đủ 130 cột, chỉ là thiếu một cột không ai đếm.
 */
const GOC = path.resolve(__dirname, '..', '..', '..');
const doc = (p: string) => fs.readFileSync(path.join(GOC, p), 'utf8');

describe('CỔNG: danh mục trường form sinh ra khớp nguồn', () => {
  const boCuc = doc('frontend/src/features/cases/legacy-form-layout.def.ts');
  const rangBuoc = doc('frontend/src/features/petitions/legacy-form-binding.ts');
  const oAn = doc('frontend/src/features/petitions/o-an.def.ts');

  it('bộ dò đọc được bố cục — không rơi về rỗng khi biểu thức hỏng', () => {
    expect(docBoCuc(boCuc).length).toBeGreaterThan(120);
    expect(Object.keys(docAnhXaCot(rangBuoc)).length).toBeGreaterThan(30);
    expect(docOBo(oAn, rangBuoc).size).toBeGreaterThanOrEqual(4);
  });

  it('chạy lại bộ sinh cho ĐÚNG bản đã commit', () => {
    const lai = dungDanhMuc(boCuc, rangBuoc, oAn, rangBuoc);
    expect(lai).toEqual([...TRUONG_FORM_DON_THU]);
  });

  it('ô đã bỏ khỏi form Đơn thư KHÔNG có trong danh mục xuất', () => {
    const bo = docOBo(oAn, rangBuoc);
    const pham = TRUONG_FORM_DON_THU.filter((t) => bo.has(t.field)).map((t) => t.field);
    expect(pham).toEqual([]);
    // Và phép loại ấy có THẬT SỰ loại được gì — không phải danh sách rỗng.
    expect(docBoCuc(boCuc).filter((o) => bo.has(o.field)).length).toBeGreaterThanOrEqual(4);
  });

  it('mọi trường có nhãn và tên ô; nhãn không rỗng', () => {
    for (const t of TRUONG_FORM_DON_THU) {
      expect(t.field).toMatch(/^[A-Za-z0-9_.]+$/);
      expect(t.caption.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * Bộ dò phải nhận CẢ HAI thứ tự khoá trong literal. Lượt soát mô hình ngoài 23/09/2026 chèn
   * một ô hợp lệ với `field` đứng TRƯỚC `caption` — cả năm mệnh đề vẫn xanh, mà ô ấy biến mất
   * khỏi tệp xuất. Bộ dò đọc HẸP hơn thực tế thì cổng của nó chỉ canh được đúng cách viết mình
   * quen, còn cách viết hợp lệ khác thì lọt.
   */
  it('nhận ô viết theo thứ tự `field` trước `caption`', () => {
    const them =
      '  { field: "oThuNghiemThuTu", caption: "Ô thử thứ tự", kind: "text", span: "half" },';
    const ds = docBoCuc(boCuc + String.fromCharCode(10) + them);
    expect(ds.some((o) => o.field === 'oThuNghiemThuTu')).toBe(true);
    expect(ds.find((o) => o.field === 'oThuNghiemThuTu')?.caption).toBe('Ô thử thứ tự');
  });

  it('khoá lưu của ô nhánh `statistic.` đã CẮT tiền tố', () => {
    const coStatistic = TRUONG_FORM_DON_THU.filter((t) => t.field.startsWith('statistic.'));
    expect(coStatistic.length).toBeGreaterThan(30);
    for (const t of coStatistic) expect(t.khoaLuu).not.toContain('statistic.');
  });

  it('tên ô KHÔNG trùng nhau', () => {
    const f = TRUONG_FORM_DON_THU.map((t) => t.field);
    expect(f.length).toBe(new Set(f).size);
  });
});
