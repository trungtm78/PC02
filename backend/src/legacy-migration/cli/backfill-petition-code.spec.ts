import { maCoSo, capMaDuyNhat } from './backfill-petition-code';

describe('backfill-petition-code', () => {
  describe('maCoSo', () => {
    it('ghép năm với số thứ tự theo đúng dạng hệ cũ', () => {
      expect(maCoSo(2018, 2360)).toBe('2018-2360');
      expect(maCoSo('2026', '9209')).toBe('2026-9209');
    });

    it('dùng `stt` chứ KHÔNG dùng `stt_cu` — 2018-2360 có stt_cu=1964', () => {
      // Quy tắc suy từ dữ liệu thật: hồ sơ hiển thị 2018-2360 mang nam=2018, stt=2360,
      // stt_cu=1964. Lấy nhầm stt_cu sẽ sinh mã không khớp bất kỳ hồ sơ nào hệ cũ.
      expect(maCoSo(2018, 2360)).not.toBe('2018-1964');
    });

    it('thiếu hoặc sai dạng thì KHÔNG đoán — trả undefined để giữ mã tạm', () => {
      expect(maCoSo(null, 2360)).toBeUndefined();
      expect(maCoSo(2018, null)).toBeUndefined();
      expect(maCoSo('20', 2360)).toBeUndefined();
      expect(maCoSo(2018, 'abc')).toBeUndefined();
    });
  });

  describe('capMaDuyNhat', () => {
    it('giữ nguyên mã khi chưa ai dùng', () => {
      expect(capMaDuyNhat('2025-1', new Set())).toBe('2025-1');
    });

    it('thêm hậu tố khi trùng, thay vì ném lỗi giữa chừng', () => {
      const daDung = new Set(['2025-1', '2025-1-2']);
      expect(capMaDuyNhat('2025-1', daDung)).toBe('2025-1-3');
    });

    it('ghi nhận mã vừa cấp để hai hồ sơ cùng lượt không đụng nhau', () => {
      const daDung = new Set<string>();
      expect(capMaDuyNhat('2025-9', daDung)).toBe('2025-9');
      expect(capMaDuyNhat('2025-9', daDung)).toBe('2025-9-2');
    });
  });
});
