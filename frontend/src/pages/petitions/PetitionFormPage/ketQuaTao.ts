import { toDateInput } from '@/lib/dates';
import type { PetitionFormData } from './types';

/** Phần của phản hồi `POST /petitions` mà form cần để khỏi lệch với bản ghi vừa tạo. */
export interface PhanHoiTaoDon {
  id?: string;
  updatedAt?: string;
  stt?: string;
  deadline?: string | null;
}

/**
 * Giá trị do MÁY CHỦ cấp lúc tạo đơn, cần nạp ngược vào form.
 *
 * Sau POST, form chuyển sang chế độ "đã có đơn" và lần lưu kế là PUT. Nếu form không nạp lại hạn giải
 * quyết máy chủ vừa tính (từ ngày tiếp nhận + quy tắc hạn đang hiệu lực), ô hạn vẫn rỗng và PUT gửi
 * `deadline: null` — máy chủ hiểu đó là lệnh XOÁ hạn. Gặp khi upload tệp lỗi rồi lưu lại, hoặc "Lưu và
 * xuất file" ở lại form. Lỗi có từ trước cho mọi đơn tạo mới (Codex bắt khi review đường chép đơn).
 *
 * Chỉ trả các khoá có giá trị: thiếu hạn trong phản hồi thì KHÔNG đụng tới ô hạn người dùng đang có.
 */
export function phanNapLaiSauKhiTao(
  data: PhanHoiTaoDon | undefined,
): Partial<Pick<PetitionFormData, 'stt' | 'deadline'>> {
  const out: Partial<Pick<PetitionFormData, 'stt' | 'deadline'>> = {};
  if (data?.stt) out.stt = data.stt;
  if (data?.deadline) {
    const ngay = toDateInput(data.deadline);
    if (ngay) out.deadline = ngay;
  }
  return out;
}
