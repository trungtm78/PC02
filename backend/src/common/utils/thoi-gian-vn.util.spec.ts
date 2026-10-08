/**
 * Giờ/ngày Việt Nam — độc lập múi giờ máy chủ.
 *
 * Mọi đầu vào là THỜI ĐIỂM TUYỆT ĐỐI (Date); đầu ra đọc theo Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè). Ca kiểm dùng
 * các thời điểm cố định nên đúng dù tiến trình jest chạy ở TZ nào (CI: UTC, máy dev/prod: giờ Việt Nam).
 */
import {
  DAU_GIO_PHUT,
  DUNG_SAI_GIO_PHUT,
  gioPhutVN,
  homNayVN,
  laGioPhutHopLe,
  laThoiDiemTuongLai,
  ngayVN,
  phanNgayVN,
} from './thoi-gian-vn.util';

describe('thoi-gian-vn.util', () => {
  describe('ngayVN / phanNgayVN — ngày theo giờ Việt Nam', () => {
    it('00:00 UTC (ngày nhập dạng YYYY-MM-DD) = 07:00 VN cùng ngày', () => {
      expect(ngayVN(new Date('2026-10-08T00:00:00Z'))).toBe('2026-10-08');
      expect(phanNgayVN(new Date('2026-10-08T00:00:00Z'))).toEqual({ ngay: 8, thang: 10, nam: 2026 });
    });

    it('17:00 UTC = 00:00 VN NGÀY HÔM SAU (bẫy: máy chủ UTC đọc ra hôm trước)', () => {
      expect(ngayVN(new Date('2026-10-07T17:00:00Z'))).toBe('2026-10-08');
      expect(phanNgayVN(new Date('2026-10-07T17:00:00Z'))).toEqual({ ngay: 8, thang: 10, nam: 2026 });
    });

    it('16:59 UTC vẫn còn hôm đó theo giờ VN (23:59)', () => {
      expect(ngayVN(new Date('2026-10-07T16:59:59Z'))).toBe('2026-10-07');
    });

    it('qua ranh giới tháng/năm', () => {
      expect(ngayVN(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
      expect(ngayVN(new Date('2026-02-28T17:30:00Z'))).toBe('2026-03-01');
    });

    it('đầu vào không hợp lệ → null (không ném lỗi)', () => {
      expect(phanNgayVN(new Date('khong-phai-ngay'))).toBeNull();
      expect(ngayVN(new Date('khong-phai-ngay'))).toBe('');
    });
  });

  describe('gioPhutVN — HH:mm 24 giờ, KHÔNG BAO GIỜ "24:xx"', () => {
    it('00:05 VN (17:05Z hôm trước) ra "00:05", không phải "24:05"', () => {
      expect(gioPhutVN(new Date('2026-10-07T17:05:00Z'))).toBe('00:05');
    });
    it('giữa trưa và cuối ngày', () => {
      expect(gioPhutVN(new Date('2026-10-08T05:30:00Z'))).toBe('12:30');
      expect(gioPhutVN(new Date('2026-10-08T16:59:00Z'))).toBe('23:59');
      expect(gioPhutVN(new Date('2026-10-08T00:00:00Z'))).toBe('07:00');
    });
  });

  describe('homNayVN', () => {
    it('lấy theo giờ VN: 18:00 UTC đã là ngày hôm sau', () => {
      expect(homNayVN(new Date('2026-10-08T18:00:00Z'))).toBe('2026-10-09');
    });
  });

  describe('laGioPhutHopLe', () => {
    it.each(['00:00', '00:59', '09:30', '12:00', '19:07', '23:59'])('%s hợp lệ', (v) => {
      expect(laGioPhutHopLe(v)).toBe(true);
      expect(DAU_GIO_PHUT.test(v)).toBe(true);
    });
    it.each(['24:00', '9:30', '09:60', '0930', '09:30:00', '09-30', '', ' 09:30', '09:30 ', 'ab:cd', '-1:00', '9:5', '099:30'])(
      '"%s" KHÔNG hợp lệ',
      (v) => {
        expect(laGioPhutHopLe(v)).toBe(false);
      },
    );
    it('không phải chuỗi → không hợp lệ', () => {
      for (const v of [null, undefined, 930, {}, [], true]) expect(laGioPhutHopLe(v)).toBe(false);
    });
  });

  describe('laThoiDiemTuongLai — ngày hôm nay + giờ vượt quá dung sai', () => {
    // 08/10/2026 14:00 giờ VN = 07:00Z
    const BAY_GIO = new Date('2026-10-08T07:00:00Z');

    it('dung sai là 5 phút', () => {
      expect(DUNG_SAI_GIO_PHUT).toBe(5);
    });

    it('hôm nay, giờ đã qua → không phải tương lai', () => {
      expect(laThoiDiemTuongLai('2026-10-08', '09:30', BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', '14:00', BAY_GIO)).toBe(false);
    });

    it('hôm nay, +4 phút (trong dung sai lệch đồng hồ) → nhận; +5 phút → nhận; +6 phút → từ chối', () => {
      expect(laThoiDiemTuongLai('2026-10-08', '14:04', BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', '14:05', BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', '14:06', BAY_GIO)).toBe(true);
    });

    it('hôm nay, hẳn một giờ sau → từ chối', () => {
      expect(laThoiDiemTuongLai('2026-10-08', '23:59', BAY_GIO)).toBe(true);
    });

    it('NGÀY QUÁ KHỨ: giờ nào cũng nhận (kể cả 23:59)', () => {
      expect(laThoiDiemTuongLai('2026-10-07', '23:59', BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-01-01', '23:59', BAY_GIO)).toBe(false);
    });

    it('không có giờ (null/undefined/rỗng) → không có gì để kiểm', () => {
      expect(laThoiDiemTuongLai('2026-10-08', null, BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', undefined, BAY_GIO)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', '', BAY_GIO)).toBe(false);
    });

    it('ngày dạng ISO đầy đủ hoặc Date đều đọc theo NGÀY VN', () => {
      expect(laThoiDiemTuongLai('2026-10-08T00:00:00.000Z', '23:00', BAY_GIO)).toBe(true);
      expect(laThoiDiemTuongLai(new Date('2026-10-08T00:00:00Z'), '09:00', BAY_GIO)).toBe(false);
    });

    it('rạng sáng VN (00:02) — giờ 00:06 trong dung sai; 00:08 là tương lai', () => {
      const raHangSang = new Date('2026-10-07T17:02:00Z'); // 00:02 ngày 08/10 giờ VN
      expect(laThoiDiemTuongLai('2026-10-08', '00:06', raHangSang)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-08', '00:08', raHangSang)).toBe(true);
    });

    it('ngày hôm qua theo VN nhưng hôm nay theo UTC không bị coi là hôm nay', () => {
      // 09/10 00:30 VN = 08/10 17:30Z. Ngày khai 08/10 (hôm qua VN): 23:59 là quá khứ.
      const sauNuaDem = new Date('2026-10-08T17:30:00Z');
      expect(laThoiDiemTuongLai('2026-10-08', '23:59', sauNuaDem)).toBe(false);
      expect(laThoiDiemTuongLai('2026-10-09', '00:50', sauNuaDem)).toBe(true);
    });
  });
});
