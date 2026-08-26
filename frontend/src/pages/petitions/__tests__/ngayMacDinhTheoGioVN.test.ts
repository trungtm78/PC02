import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Ngày mặc định của form phải theo giờ Việt Nam, không theo UTC.
 *
 * Từ 00:00 đến 06:59 giờ Việt Nam, `new Date().toISOString()` còn đang ở ngày HÔM QUA theo
 * UTC. Cán bộ trực đêm mở form tạo đơn thư sẽ thấy "Ngày tiếp nhận" lùi một ngày, và
 * `useFormDefaults` không chữa được vì ô đã có giá trị nên nó bỏ qua.
 *
 * Kho mã đã có `today()` dùng đúng múi giờ Việt Nam ở `@/lib/dates` — phải dùng lại, không
 * viết bản thứ hai. Ca kiểm giả đồng hồ vào đúng khung giờ ấy, vì chạy ban ngày thì hai cách
 * tính cho cùng kết quả và lỗi không lộ.
 */

/** 01:00 ngày 26/08/2026 giờ Việt Nam = 18:00 ngày 25/08/2026 giờ UTC. */
const RANG_SANG_VN = new Date('2026-08-25T18:00:00.000Z');
const NGAY_VN = '2026-08-26';

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('Ngày mặc định trên form Đơn thư', () => {
  it.each(['receivedDate', 'ngayTiepNhanNguonTin', 'ngayDeXuat'] as const)(
    'ô "%s" lấy ngày theo giờ Việt Nam, không lùi một ngày lúc rạng sáng',
    async (khoa) => {
      vi.useFakeTimers();
      vi.setSystemTime(RANG_SANG_VN);
      vi.resetModules();

      const { INITIAL_PETITION_FORM } = await import('../PetitionFormPage/types');
      expect(INITIAL_PETITION_FORM[khoa]).toBe(NGAY_VN);
    },
  );
});
