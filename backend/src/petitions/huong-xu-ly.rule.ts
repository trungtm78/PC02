import { HuongXuLyDon, PetitionStatus } from '@prisma/client';

/**
 * Luật của ba hướng xử lý đơn thư — gom một chỗ vì BA nơi cùng đọc: bộ dựng dữ liệu lúc tạo,
 * đường cập nhật lúc sửa, và migration backfill.
 *
 *      chọn hướng trên form
 *              │
 *              ├─► thuocThamQuyen  (cột cũ, suy ra — không còn ô nhập)
 *              ├─► câu "Đề xuất" + ô "Kính gửi"   (field-catalog.ts)
 *              └─► trạng thái hồ sơ   ── CHỈ khi hướng thực sự đổi ──►
 */

/** Hướng nào là xử lý NỘI BỘ — dùng để suy cột `thuocThamQuyen` đã bỏ khỏi form. */
export function suyThuocThamQuyen(huong: HuongXuLyDon | undefined | null): boolean | undefined {
  if (!huong) return undefined; // không chọn thì không suy bừa, để service khỏi ghi đè cột
  return huong !== HuongXuLyDon.CHUYEN_DON;
}

/**
 * Trạng thái tương ứng mỗi hướng.
 *
 * `TRA_LUU_DON` → `DA_TRA_DON`: "Trả đơn" và "Lưu đơn" là một việc về nghiệp vụ (quyết định
 * 09/09/2026), nên `DA_LUU_DON` không được dùng cho hướng này.
 */
export function trangThaiTheoHuong(huong: HuongXuLyDon): PetitionStatus {
  switch (huong) {
    case HuongXuLyDon.CHUYEN_DON:
      return PetitionStatus.DA_CHUYEN_DON_VI;
    case HuongXuLyDon.TRA_LUU_DON:
      return PetitionStatus.DA_TRA_DON;
    default:
      return PetitionStatus.DANG_XU_LY;
  }
}

/**
 * Có được đổi trạng thái trong lần lưu này không.
 *
 * Áp trạng thái ở MỌI lần lưu là hỏng lặng lẽ: cán bộ sửa số điện thoại người gửi rồi bấm Lưu
 * sẽ kéo hồ sơ ngược về trạng thái của hướng, xoá mất thay đổi trạng thái người khác vừa làm
 * bằng đường khác — và không có thông báo nào.
 */
export function canDoiTrangThai(
  huongCu: HuongXuLyDon | null | undefined,
  huongMoi: HuongXuLyDon | undefined | null,
): boolean {
  if (!huongMoi) return false; // lần lưu này không gửi hướng
  return huongCu !== huongMoi;
}

/**
 * Chiều ngược của `trangThaiTheoHuong`: suy hướng từ trạng thái.
 *
 * Cho hồ sơ vào hệ mới KHÔNG qua form — bộ nạp hệ cũ. Cùng luật với migration backfill
 * `20260909150000_huong_xu_ly_don`; trước đây luật chỉ nằm trong tệp SQL ấy nên bộ nạp không
 * đọc được, và đợt nạp 11/09/2026 đưa vào 434 đơn thư mang hướng trống.
 */
export function huongTheoTrangThai(status: PetitionStatus | string | null | undefined): HuongXuLyDon {
  if (status === PetitionStatus.DA_CHUYEN_DON_VI) return HuongXuLyDon.CHUYEN_DON;
  if (status === PetitionStatus.DA_TRA_DON || status === PetitionStatus.DA_LUU_DON) {
    return HuongXuLyDon.TRA_LUU_DON;
  }
  return HuongXuLyDon.GIAO_DON;
}
