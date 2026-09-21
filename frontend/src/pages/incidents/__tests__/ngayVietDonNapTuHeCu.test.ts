import { describe, it, expect } from 'vitest';
import { mergeIncidentApiToFormData } from '../mergeIncidentApiToFormData';

/*
  Hồ sơ DI TRÚ: bản gốc ngày viết đơn nằm ở `legacyRaw.ngay_viet_don`, ba cột đều rỗng.

  Đo prod 21/09/2026: 4.454 đơn thư + 7 vụ việc + 15 vụ án. Hàm hiển thị phía máy chủ vẫn IN ra
  chữ gốc, nhưng form mở ra thì ô TRỐNG — cán bộ không nhìn thấy thứ hệ sắp in.

  Đây là lớp "bấm thử hồ sơ DI TRÚ mới thấy": tạo một hồ sơ mới rồi thử thì không bao giờ gặp.
*/
const nap = (d: Record<string, unknown>) =>
  mergeIncidentApiToFormData({ ...d } as never);

describe('Ngày viết đơn — nạp chữ gốc hệ cũ vào ô', () => {
  it('ba cột rỗng + hệ cũ có chữ → ô hiện ĐÚNG chữ gốc', () => {
    const ra = nap({ legacyRaw: { ngay_viet_don: '19/4/2021 (03 đơn), 20/4/2021' } });
    expect(ra.ngayVietDonChu).toBe('19/4/2021 (03 đơn), 20/4/2021');
  });

  /*
    Hồ sơ cán bộ ĐÃ sửa trên hệ mới không được để bản gốc chưa sửa đè lên — cùng lý lẽ đã đặt
    cho thứ tự ưu tiên ở hàm hiển thị phía máy chủ.
  */
  it('đã có ngày thật trên hệ mới → KHÔNG nạp chữ gốc', () => {
    const ra = nap({
      ngayVietDon: '2026-01-31',
      legacyRaw: { ngay_viet_don: '19/4/2021 (03 đơn)' },
    });
    expect(ra.ngayVietDonChu).toBe('');
  });

  it('đã có chữ nguyên văn trên hệ mới → giữ chữ ấy, không lấy bản gốc', () => {
    const ra = nap({
      ngayVietDonChu: 'Không ghi ngày',
      legacyRaw: { ngay_viet_don: '19/4/2021 (03 đơn)' },
    });
    expect(ra.ngayVietDonChu).toBe('Không ghi ngày');
  });

  it('hệ cũ không có khoá → ô trống, không ném', () => {
    expect(nap({}).ngayVietDonChu).toBe('');
    expect(nap({ legacyRaw: {} }).ngayVietDonChu).toBe('');
    expect(nap({ legacyRaw: null }).ngayVietDonChu).toBe('');
  });
});
