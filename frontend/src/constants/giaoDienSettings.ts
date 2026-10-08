/**
 * Cấu hình giao diện do admin đặt: hành động khi BẤM VÀO MỘT DÒNG của danh sách.
 *
 * WIRE FORMAT — khớp `backend/src/common/constants/giao-dien.constants.ts` (giá trị hợp lệ + mặc định) và migration
 * `20261008090000_bam_dong_settings`. Có cổng đồng bộ `giaoDienDongBo.gate.test.ts`: lệch một chữ là đỏ.
 */
import type { LuaChonCaiDat } from './thongKeSettings';

export type BamDongGiaTri = 'KHONG' | 'XEM' | 'XEM_HAI_CHAM' | 'SUA' | 'SUA_HAI_CHAM';

export const BAM_DONG_OPTIONS: readonly (LuaChonCaiDat & { value: BamDongGiaTri })[] = [
  { value: 'KHONG', label: 'Không làm gì (chỉ để bôi chữ, chép dữ liệu)' },
  { value: 'XEM', label: 'Mở xem chi tiết — 1 cú bấm' },
  { value: 'XEM_HAI_CHAM', label: 'Mở xem chi tiết — bấm đúp' },
  { value: 'SUA', label: 'Mở form sửa — 1 cú bấm' },
  { value: 'SUA_HAI_CHAM', label: 'Mở form sửa — bấm đúp' },
] as const;

/** Màn → khoá cấu hình. */
export const MAN_BAM_DONG = {
  DON_THU: 'BAM_DONG_DON_THU',
  DON_THU_PHUONG: 'BAM_DONG_DON_THU_PHUONG',
  DON_TRUNG: 'BAM_DONG_DON_TRUNG',
  VU_VIEC: 'BAM_DONG_VU_VIEC',
  VU_AN: 'BAM_DONG_VU_AN',
  TONG_HOP: 'BAM_DONG_TONG_HOP',
  UY_THAC: 'BAM_DONG_UY_THAC',
} as const;

export type ManBamDong = keyof typeof MAN_BAM_DONG;
export type KhoaBamDong = (typeof MAN_BAM_DONG)[ManBamDong];

export const KHOA_BAM_DONG: readonly KhoaBamDong[] = Object.values(MAN_BAM_DONG);

/** Mặc định trong mã — dùng khi chưa tải được cấu hình (mạng lỗi, API cũ) và cho nút "Về mặc định". */
export const BAM_DONG_MAC_DINH: Record<KhoaBamDong, BamDongGiaTri> = {
  BAM_DONG_DON_THU: 'KHONG',
  BAM_DONG_DON_THU_PHUONG: 'KHONG',
  BAM_DONG_DON_TRUNG: 'KHONG',
  BAM_DONG_VU_VIEC: 'XEM',
  BAM_DONG_VU_AN: 'XEM',
  BAM_DONG_TONG_HOP: 'XEM',
  BAM_DONG_UY_THAC: 'XEM',
};

export function laGiaTriBamDong(v: unknown): v is BamDongGiaTri {
  return typeof v === 'string' && BAM_DONG_OPTIONS.some((o) => o.value === v);
}

/** Gộp dữ liệu máy chủ với mặc định: khoá thiếu hoặc giá trị lạ → mặc định, không bao giờ ném lỗi. */
export function gopCauHinhBamDong(thô: unknown): Record<KhoaBamDong, BamDongGiaTri> {
  const nguon = thô && typeof thô === 'object' ? (thô as Record<string, unknown>) : {};
  const kq = { ...BAM_DONG_MAC_DINH };
  for (const k of KHOA_BAM_DONG) {
    const v = nguon[k];
    if (laGiaTriBamDong(v)) kq[k] = v;
  }
  return kq;
}

/** Lựa chọn / mặc định của các khoá này — `thongKeSettings.ts` gộp vào bảng chung của trang Cài đặt. */
export const LUA_CHON_GIAO_DIEN: Record<string, readonly LuaChonCaiDat[]> = Object.fromEntries(
  KHOA_BAM_DONG.map((k) => [k, BAM_DONG_OPTIONS]),
);
export const MAC_DINH_GIAO_DIEN: Record<string, string> = { ...BAM_DONG_MAC_DINH };

export const NHAN_NHOM_HANH_VI_DANH_SACH = 'Hành vi danh sách — khi bấm vào một dòng';

export function laKhoaBamDong(key: string): boolean {
  return (KHOA_BAM_DONG as readonly string[]).includes(key);
}
