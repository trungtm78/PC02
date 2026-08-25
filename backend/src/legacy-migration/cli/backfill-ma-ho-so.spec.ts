import { maTuBanTho, capMaDuyNhat } from './backfill-ma-ho-so';

/**
 * Bù mã hồ sơ cho vụ án / vụ việc di trú còn thiếu hoặc mang mã tạm.
 *
 * Phát hiện trong lúc UAT ngày 25/08/2026, khi cột mã bắt đầu hiện rõ trên danh sách:
 * 76/3.380 vụ án KHÔNG có mã, 125/4.717 vụ việc mang mã tạm `VV-LEGACY-…`.
 *
 * Quy tắc suy TỪ DỮ LIỆU chứ không từ giả định: đối chiếu 8 mẫu ngẫu nhiên trong nhóm vụ án
 * đã có mã cho thấy `caseCode = <nam>-<stt>` — dùng trường `stt`, KHÔNG phải `stt_cu`
 * (vd `2019-125` có nam=2019, stt=125, stt_cu=81).
 */
describe('maTuBanTho', () => {
  it('ghép năm với số thứ tự đúng dạng hệ cũ', () => {
    expect(maTuBanTho({ nam: 2019, stt: 125 })).toBe('2019-125');
    expect(maTuBanTho({ nam: '2026', stt: '973' })).toBe('2026-973');
  });

  it('dùng `stt` chứ KHÔNG dùng `stt_cu` — 2019-125 có stt_cu=81', () => {
    // Lấy nhầm `stt_cu` sẽ sinh mã không khớp bất kỳ hồ sơ nào ở hệ cũ.
    expect(maTuBanTho({ nam: 2019, stt: 125, stt_cu: 81 })).toBe('2019-125');
  });

  it('thiếu hoặc sai dạng thì trả undefined — KHÔNG đoán', () => {
    expect(maTuBanTho({ nam: 2019 })).toBeUndefined();
    expect(maTuBanTho({ stt: 125 })).toBeUndefined();
    expect(maTuBanTho({ nam: 'hai nghìn', stt: 125 })).toBeUndefined();
    expect(maTuBanTho({ nam: 2019, stt: 'abc' })).toBeUndefined();
    expect(maTuBanTho({})).toBeUndefined();
    expect(maTuBanTho(null)).toBeUndefined();
  });

  it('năm ngoài khoảng hợp lý bị từ chối — 3023 là lỗi gõ đã biết', () => {
    expect(maTuBanTho({ nam: 3023, stt: 5325 })).toBeUndefined();
    expect(maTuBanTho({ nam: 1899, stt: 5 })).toBeUndefined();
  });
});

describe('capMaDuyNhat', () => {
  it('giữ nguyên mã khi chưa ai dùng', () => {
    expect(capMaDuyNhat('2026-973', new Set())).toBe('2026-973');
  });

  it('thêm hậu tố khi trùng thay vì ném lỗi giữa chừng', () => {
    expect(capMaDuyNhat('2026-973', new Set(['2026-973', '2026-973-2']))).toBe('2026-973-3');
  });

  it('ghi nhận mã vừa cấp để hai hồ sơ cùng lượt không đụng nhau', () => {
    const daDung = new Set<string>();
    expect(capMaDuyNhat('2025-1', daDung)).toBe('2025-1');
    expect(capMaDuyNhat('2025-1', daDung)).toBe('2025-1-2');
  });
});
