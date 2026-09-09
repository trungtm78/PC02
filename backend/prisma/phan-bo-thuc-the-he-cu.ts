/**
 * Hồ sơ hệ cũ thật sự nằm ở thực thể nào của hệ mới.
 *
 * ── Vì sao cần bảng này ──
 *
 * Hệ cũ chọn mẫu in theo `loai` của hồ sơ. Hệ mới chọn mẫu theo THỰC THỂ (Đơn thư · Vụ việc ·
 * Vụ án). Hai cách phân loại KHÔNG trùng nhau: bộ di trú xếp hồ sơ theo trạng thái tố tụng, chứ
 * không theo `loai`. Nên một mẫu khai cho đúng MỘT thực thể là chứng từ hệ cũ in được mà hệ mới
 * không mời in.
 *
 * ── Đo được gì (09/09/2026, 54.697 hồ sơ có mã hệ cũ trên máy thật) ──
 *
 * | Mẫu | Khai cho | Phân bố thật | Không in được |
 * |---|---|---|---|
 * | `HE_CU_VU_AN` | VU_AN | VV 4.186 · ĐT 152 · VA 1.220 | 4.338 / 5.558 |
 * | `HE_CU_TRA_HO_SO` | DON_THU | VV 385 · VA 56 · ĐT 3 | 441 / 444 |
 * | `HE_CU_DON_THU` | DON_THU | ĐT 46.443 · VA 220 · VV 25 | 245 / 46.688 |
 * | `HE_CU_DANG_KY_BAO_CHUA` | DON_THU | VA 198 · ĐT 132 | 198 / 330 |
 * | `HE_CU_UY_THAC` | VU_AN | VA 1.665 · ĐT 4 | 4 / 1.669 |
 * | `HE_CU_TRAO_DOI` | DON_THU | ĐT 6 · VA 1 | 1 / 7 |
 *
 * Cộng lại **5.227 hồ sơ**. Đây là SỐ ĐO trên dữ liệu thật, không phải suy đoán — chép lại kèm
 * ngày để lần sau ai đọc cũng biết nó cũ tới đâu.
 *
 * Mẫu chỉ thêm ở thực thể ĐÃ ĐO CÓ hồ sơ. Rải cả ba thực thể cho mọi mẫu là nhét vào popup in
 * những chứng từ chưa hồ sơ nào thuộc loại ấy cần tới.
 */
export type ThucTheMau = 'DON_THU' | 'VU_VIEC' | 'VU_AN';

export const PHAN_BO_THUC_THE_DO_DUOC: Readonly<Record<string, readonly ThucTheMau[]>> = {
  HE_CU_DON_THU: ['DON_THU', 'VU_VIEC', 'VU_AN'],
  HE_CU_VU_AN: ['VU_AN', 'VU_VIEC', 'DON_THU'],
  HE_CU_TRA_HO_SO: ['DON_THU', 'VU_VIEC', 'VU_AN'],
  HE_CU_DANG_KY_BAO_CHUA: ['DON_THU', 'VU_AN'],
  HE_CU_UY_THAC: ['VU_AN', 'DON_THU'],
  HE_CU_TRAO_DOI: ['DON_THU', 'VU_AN'],
  HE_CU_HUONG_DAN: ['DON_THU'],
  // Ba mẫu hệ cũ CHƯA TỪNG in ra lần nào, và mẫu biên nhận đi theo hồ sơ đơn thư.
  HE_CU_BIEN_NHAN: ['DON_THU'],
  HE_CU_SO_DANG_KY_BAO_CHUA: ['DON_THU'],
  HE_CU_VU_VIEC: ['VU_VIEC'],
  HE_CU_AN_TRA_BO_SUNG: ['VU_AN'],
};
