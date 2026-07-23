/**
 * Tự phán đoán loại hồ sơ khi dữ liệu gốc KHÔNG có trường phân loại nào.
 *
 * Bình thường bộ ánh xạ đọc `phan_loai_nguon_tin_ban_dau`, thiếu thì lùi về `loai`.
 * Một số hồ sơ (đo trên dump: 4 hồ sơ của bảng `ho_so`, đều thuộc 2026) không có cả hai
 * → trước đây bị bỏ qua hoàn toàn. Ở đây suy đoán từ chính NỘI DUNG nghiệp vụ, và LUÔN
 * kèm căn cứ + độ tin cậy để người duyệt lật lại được.
 *
 * Nguyên tắc: chỉ suy từ dấu hiệu nghiệp vụ có thật trong bản ghi (số quyết định, câu
 * chữ trong tóm tắt), không suy từ phỏng đoán chủ quan. Không có dấu hiệu nào thì trả
 * độ tin cậy thấp nhất để người duyệt biết mà kiểm tay.
 */
import { normalizeVi } from './org-mapper';

export type InferredClass = 'vu-an-ban-dau' | 'vu-viec-ban-dau' | 'don-cong-van-ban-dau' | 'huong-dan-ban-dau';

export interface InferResult {
  phanLoai: InferredClass;
  /** cao = có quyết định tố tụng rõ ràng · vừa = có câu chữ nghiệp vụ · thấp = mặc định */
  confidence: 'cao' | 'vừa' | 'thấp';
  reason: string;
}

const has = (v: unknown): boolean => v !== null && v !== undefined && String(v).trim() !== '';

export function inferClass(rec: Record<string, unknown>): InferResult {
  const text = normalizeVi(
    [rec.tom_tat_noi_dung, rec.ket_qua_xu_ly_giai_quyet_khac, rec.noi_dung_don].filter(Boolean).join(' '),
  );

  // 1. Có quyết định khởi tố vụ án → chắc chắn là vụ án, không cần đoán.
  if (has(rec.quyet_dinh_khoi_to_vu_an) || has(rec.ngay_quyet_dinh_khoi_to_vu_an)) {
    return { phanLoai: 'vu-an-ban-dau', confidence: 'cao', reason: 'có quyết định khởi tố vụ án' };
  }

  // 2. Có quyết định phân công giải quyết nguồn tin → đang xác minh nguồn tin = vụ việc.
  if (has(rec.quyet_dinh_phan_cong_giai_quyet_nguon_tin) || has(rec.ngay_ra_quyet_dinh_phan_cong_tin_bao)) {
    return { phanLoai: 'vu-viec-ban-dau', confidence: 'cao', reason: 'có quyết định phân công giải quyết nguồn tin' };
  }

  // 3. Có quyết định tạm đình chỉ / không khởi tố nguồn tin → vòng đời của vụ việc.
  if (has(rec.quyet_dinh_tam_dinh_chi_nguon_tin) || has(rec.quyet_dinh_khong_khoi_to_vu_an)) {
    return { phanLoai: 'vu-viec-ban-dau', confidence: 'cao', reason: 'có quyết định tạm đình chỉ / không khởi tố nguồn tin' };
  }

  // 4. Câu chữ nghiệp vụ trong nội dung.
  if (/nguon tin|to giac|tin bao|kien nghi khoi to|xac minh/.test(text)) {
    return { phanLoai: 'vu-viec-ban-dau', confidence: 'vừa', reason: 'nội dung nói về tố giác / tin báo / xác minh nguồn tin' };
  }
  if (/huong dan|khoi kien|tra don/.test(text)) {
    return { phanLoai: 'huong-dan-ban-dau', confidence: 'vừa', reason: 'nội dung nói về hướng dẫn / trả đơn' };
  }
  if (has(rec.ten_ca_nhan_co_quan_to_chuc_cung_cap) && /don|khieu nai|to cao|kien nghi/.test(text)) {
    return { phanLoai: 'don-cong-van-ban-dau', confidence: 'vừa', reason: 'có người gửi và nội dung mang tính đơn thư' };
  }

  // 5. Không có dấu hiệu nào: mặc định là vụ việc (nguồn tin) — đây là loại phổ biến nhất
  //    của hồ sơ tiếp nhận ban đầu, và là cái bảng `ho_so` của hệ cũ dùng để ghi.
  //    Đánh dấu độ tin cậy THẤP để người duyệt biết cần kiểm tay.
  return { phanLoai: 'vu-viec-ban-dau', confidence: 'thấp', reason: 'không có dấu hiệu nghiệp vụ nào — lấy mặc định, CẦN KIỂM TAY' };
}

/** Bản ghi có trường phân loại hợp lệ hay không (để biết có cần suy đoán không). */
export function needsInference(rec: Record<string, unknown>): boolean {
  return !has(rec.phan_loai_nguon_tin_ban_dau) && !has(rec.loai);
}
