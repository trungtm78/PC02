import { DYNAMIC_EXPORT_SAVABLE } from './entity-placeholders';
import { resolveField } from './field-catalog';

/**
 * CỔNG: cột mà popup "Lưu bổ sung thông tin thiếu" ghi xuống phải là cột mà bản in ĐỌC LÊN.
 *
 * ── Vì sao cần ──
 *
 * Hai đường cùng sửa một ô trên giao diện: form Đơn thư ghi vào cột của nó, còn popup lúc in
 * ghi vào cột khai ở `DYNAMIC_EXPORT_SAVABLE`. Hai bảng nằm ở hai tệp, mỗi bên tự nhất quán —
 * nên khi chúng trỏ hai cột khác nhau thì KHÔNG ca kiểm khứ hồi nào thấy: popup ghi cột A rồi
 * đọc lại cột A, form ghi cột B rồi đọc lại cột B. Cán bộ thì thấy: điền ở popup, lưu, mở form
 * ra vẫn trống.
 *
 * Đo 10/09/2026: đổi `donViNhan` sang cột khác mà 469 ca kiểm vùng chứng từ vẫn xanh — cổng này
 * ra đời từ chỗ trống ấy.
 *
 * Phép kiểm là KHỨ HỒI: đặt giá trị vào ĐÚNG cột popup ghi, rồi hỏi bản in. Trả về đúng giá trị
 * thì hai bên cùng một cột; lệch cột là rỗng ngay.
 */
describe('cổng: popup lưu bổ sung và bản in dùng cùng một cột', () => {
  const MUC = Object.entries(DYNAMIC_EXPORT_SAVABLE.DON_THU);

  it('có mục để canh — cổng phải thật sự chạy', () => {
    expect(MUC.length).toBeGreaterThan(5);
  });

  it.each(MUC)('%s ghi cột %o rồi bản in đọc lại được', (bien, meta) => {
    const gt = `GIÁ TRỊ KIỂM ${bien}`;
    const banGhi: Record<string, unknown> = { [meta.column]: gt };
    expect(resolveField('DON_THU', bien, banGhi)).toBe(gt);
  });
});
