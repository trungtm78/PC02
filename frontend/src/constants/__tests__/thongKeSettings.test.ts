import { describe, it, expect } from 'vitest';
import {
  KY_THONG_KE_OPTIONS,
  TRUONG_NGAY_OPTIONS,
  MAC_DINH_THEO_KHOA,
  KHOA_KIEU_NGAY,
  nhanKyThongKe,
  sapXepCaiDat,
  oNgayDangVoHieu,
} from '../thongKeSettings';

/**
 * Giá trị ở đây là WIRE FORMAT — phải khớp hằng số của máy chủ.
 *
 * Gõ sai không làm vỡ gì: máy chủ coi giá trị lạ là không hợp lệ và rơi về mặc định. Nhưng
 * đúng vì thế mà nguy hiểm hơn — admin chọn "Quý hiện tại", giao diện lưu thành công, và hệ
 * thống vẫn chạy theo tháng. Không ai thấy lỗi, chỉ thấy số không như mong đợi.
 */
describe('Lựa chọn cấu hình kỳ thống kê', () => {
  it('đủ năm loại kỳ anh yêu cầu', () => {
    expect(KY_THONG_KE_OPTIONS.map((o) => o.value)).toEqual([
      'THANG_HIEN_TAI',
      'QUY_HIEN_TAI',
      'NAM_HIEN_TAI',
      'KHOANG_TUY_CHON',
      'TAT_CA',
    ]);
  });

  it('hai lựa chọn trường ngày', () => {
    expect(TRUONG_NGAY_OPTIONS.map((o) => o.value)).toEqual(['NGAY_TIEP_NHAN', 'NGAY_TAO']);
  });

  it('mặc định là THÁNG HIỆN TẠI theo NGÀY TIẾP NHẬN — anh chốt', () => {
    expect(MAC_DINH_THEO_KHOA.THONG_KE_KY).toBe('THANG_HIEN_TAI');
    expect(MAC_DINH_THEO_KHOA.THONG_KE_TRUONG_NGAY).toBe('NGAY_TIEP_NHAN');
  });

  it('mọi giá trị mặc định đều nằm trong danh sách lựa chọn', () => {
    // Mặc định trỏ vào một giá trị không có trong danh sách thì ô chọn hiện trống, và bấm
    // "Về mặc định" cho ra một ô rỗng chứ không phải giá trị mặc định.
    expect(KY_THONG_KE_OPTIONS.map((o) => o.value)).toContain(MAC_DINH_THEO_KHOA.THONG_KE_KY);
    expect(TRUONG_NGAY_OPTIONS.map((o) => o.value)).toContain(
      MAC_DINH_THEO_KHOA.THONG_KE_TRUONG_NGAY,
    );
  });
});

describe('nhanKyThongKe', () => {
  it('tháng → "Tháng 8/2026"', () => {
    expect(nhanKyThongKe('THANG_HIEN_TAI', '2026-08-01', '2026-08-31')).toBe('Tháng 8/2026');
  });

  it('quý → "Quý 3/2026"', () => {
    expect(nhanKyThongKe('QUY_HIEN_TAI', '2026-07-01', '2026-09-30')).toBe('Quý 3/2026');
  });

  it('năm → "Năm 2026"', () => {
    expect(nhanKyThongKe('NAM_HIEN_TAI', '2026-01-01', '2026-12-31')).toBe('Năm 2026');
  });

  it('khoảng tuỳ chọn → hai mốc ngày', () => {
    expect(nhanKyThongKe('KHOANG_TUY_CHON', '2025-03-01', '2025-06-30')).toBe(
      '01/03/2025 – 30/06/2025',
    );
  });

  it('TAT_CA → nói rõ là tất cả, không để trống', () => {
    // Nhãn trống thì cán bộ không biết con số đang tính theo kỳ nào — mà đó chính là lý do
    // có nhãn này.
    expect(nhanKyThongKe('TAT_CA', null, null)).toBe('Tất cả thời gian');
  });

  it('thiếu mốc ngày → vẫn ra nhãn đọc được, không vỡ', () => {
    expect(nhanKyThongKe('THANG_HIEN_TAI', null, null)).toBe('Tất cả thời gian');
  });
});

/**
 * Thứ tự đọc trên trang Cài đặt hệ thống.
 *
 * Máy chủ sắp theo tên khoá, nên bốn khoá kỳ thống kê nằm rải rác và sai logic: "đến ngày"
 * đứng TRƯỚC "kỳ thống kê", "từ ngày" rơi xuống cuối. Người đọc gặp mốc kết thúc trước cả khi
 * biết đang cấu hình kỳ gì.
 */
describe('sapXepCaiDat', () => {
  it('hai mốc ngày nằm KỀ NHAU và NGAY DƯỚI khoá kỳ', () => {
    // Đây đúng là thứ tự máy chủ trả về (sắp theo tên khoá) — chính là thứ sai.
    const tuMayChu = [
      { key: 'THONG_KE_DEN_NGAY' },
      { key: 'THONG_KE_KY' },
      { key: 'THONG_KE_TRUONG_NGAY' },
      { key: 'THONG_KE_TU_NGAY' },
    ];

    expect(sapXepCaiDat(tuMayChu).map((x) => x.key)).toEqual([
      'THONG_KE_KY',
      'THONG_KE_TU_NGAY',
      'THONG_KE_DEN_NGAY',
      'THONG_KE_TRUONG_NGAY',
    ]);
  });

  it('khoá lạ giữ nguyên thứ tự máy chủ và xếp SAU, không bị vứt đi', () => {
    const ds = [
      { key: 'CANH_BAO_SAP_HAN' },
      { key: 'THONG_KE_KY' },
      { key: 'TWO_FA_ENABLED' },
    ];

    expect(sapXepCaiDat(ds).map((x) => x.key)).toEqual([
      'THONG_KE_KY',
      'CANH_BAO_SAP_HAN',
      'TWO_FA_ENABLED',
    ]);
  });

  it('không sửa mảng gốc', () => {
    const ds = [{ key: 'THONG_KE_TU_NGAY' }, { key: 'THONG_KE_KY' }];
    sapXepCaiDat(ds);
    expect(ds[0].key).toBe('THONG_KE_TU_NGAY');
  });
});

describe('oNgayDangVoHieu', () => {
  it('hai mốc ngày vô hiệu khi kỳ KHÔNG phải khoảng tuỳ chọn', () => {
    // Để chúng trông như bình thường thì admin nhập ngày, lưu thành công, và không có gì
    // đổi — rồi kết luận hệ thống hỏng.
    for (const k of KHOA_KIEU_NGAY) {
      expect(oNgayDangVoHieu(k, 'THANG_HIEN_TAI')).toBe(true);
      expect(oNgayDangVoHieu(k, 'KHOANG_TUY_CHON')).toBe(false);
    }
  });

  it('khoá khác không bao giờ bị coi là vô hiệu', () => {
    expect(oNgayDangVoHieu('THONG_KE_KY', 'THANG_HIEN_TAI')).toBe(false);
    expect(oNgayDangVoHieu('CANH_BAO_SAP_HAN', 'THANG_HIEN_TAI')).toBe(false);
  });
});
