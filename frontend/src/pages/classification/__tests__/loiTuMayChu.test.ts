import { describe, it, expect } from 'vitest';
import { loiTuMayChu, DU_PHONG_CHUNG } from '../loiTuMayChu';

/**
 * Câu dự phòng phải do NƠI GỌI đưa.
 *
 * Bản đầu chôn cứng "Không lưu được kiến nghị…" vào hàm. Khi hàm được dùng lại cho đường TẢI
 * danh sách, mất mạng cho ra màn hình tự mâu thuẫn: tiêu đề "Không tải được danh sách", dòng lý
 * do ngay dưới "Không lưu được" — sai đúng ở ca mà bản vá sinh ra để làm rõ.
 */
describe('loiTuMayChu', () => {
  it('ưu tiên thông báo trong bao bì lỗi của kho', () => {
    const e = { response: { data: { error: { code: 'X', message: 'Mã đã tồn tại' } } } };
    expect(loiTuMayChu(e, 'dự phòng')).toBe('Mã đã tồn tại');
  });

  it('chấp nhận cả dạng message phẳng', () => {
    expect(loiTuMayChu({ response: { data: { message: 'Hết hạn' } } }, 'dự phòng')).toBe('Hết hạn');
  });

  it('máy chủ im lặng thì dùng ĐÚNG câu của nơi gọi', () => {
    expect(loiTuMayChu(new Error('Network Error'), 'Không tải được danh sách.')).toBe(
      'Không tải được danh sách.',
    );
  });

  /** Không nơi gọi nào nói gì thì vẫn phải là câu TRUNG TÍNH, không gắn với thao tác nào. */
  it('không truyền dự phòng thì dùng câu trung tính', () => {
    expect(loiTuMayChu(new Error('boom'))).toBe(DU_PHONG_CHUNG);
    expect(DU_PHONG_CHUNG).not.toMatch(/lưu|tải/i);
  });

  /** KHÔNG dựng lại thông báo kỹ thuật tiếng Anh của trình duyệt cho cán bộ đọc. */
  it('không lôi message kỹ thuật của trình duyệt ra', () => {
    expect(loiTuMayChu(new Error('Network Error'), 'câu tử tế')).not.toMatch(/Network Error/);
  });
});
