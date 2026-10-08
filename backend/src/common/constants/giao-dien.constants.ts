/**
 * Cấu hình giao diện do admin đặt trong Cài đặt hệ thống — hành động khi BẤM VÀO MỘT DÒNG của danh sách.
 *
 * WIRE FORMAT: tên khoá là khoá chính của bảng `system_settings`, giá trị là chuỗi lưu trong cột `value`. Đổi tên
 * mà không có migration thì `getGiaoDien()` rơi về mặc định trong mã, và cấu hình admin đã đặt biến mất lặng lẽ.
 *
 * Ba nơi phải khớp nhau (có cổng kiểm `giao-dien.dong-bo.spec.ts` và `giaoDienDongBo.gate.test.ts`):
 *   1. tệp này (giá trị hợp lệ + mặc định),
 *   2. migration `20261008090000_bam_dong_settings` (gieo dòng vì `deploy.sh` không chạy seed settings),
 *   3. `frontend/src/constants/giaoDienSettings.ts` (lựa chọn hiện trên trang Cài đặt).
 */
export const BAM_DONG_GIA_TRI = {
  KHONG: 'KHONG',
  XEM: 'XEM',
  XEM_HAI_CHAM: 'XEM_HAI_CHAM',
  SUA: 'SUA',
  SUA_HAI_CHAM: 'SUA_HAI_CHAM',
} as const;

export type BamDongGiaTri = (typeof BAM_DONG_GIA_TRI)[keyof typeof BAM_DONG_GIA_TRI];

export const DANH_SACH_BAM_DONG_GIA_TRI: readonly string[] = Object.values(BAM_DONG_GIA_TRI);

/**
 * Mặc định theo màn. Các màn Đơn thư = KHONG vì cán bộ bôi chữ trên danh sách để chép sang nơi khác (08/10/2026);
 * các màn còn lại = XEM, đúng hành vi trước khi có cấu hình.
 */
export const BAM_DONG_MAC_DINH: Readonly<Record<string, BamDongGiaTri>> = {
  BAM_DONG_DON_THU: 'KHONG',
  BAM_DONG_DON_THU_PHUONG: 'KHONG',
  BAM_DONG_DON_TRUNG: 'KHONG',
  BAM_DONG_VU_VIEC: 'XEM',
  BAM_DONG_VU_AN: 'XEM',
  BAM_DONG_TONG_HOP: 'XEM',
  BAM_DONG_UY_THAC: 'XEM',
};

export const BAM_DONG_NHAN: Readonly<Record<string, string>> = {
  BAM_DONG_DON_THU: 'Bấm vào dòng — danh sách Đơn thư',
  BAM_DONG_DON_THU_PHUONG: 'Bấm vào dòng — Đơn thư phường/xã',
  BAM_DONG_DON_TRUNG: 'Bấm vào dòng — Đơn trùng',
  BAM_DONG_VU_VIEC: 'Bấm vào dòng — danh sách Vụ việc',
  BAM_DONG_VU_AN: 'Bấm vào dòng — danh sách Vụ án',
  BAM_DONG_TONG_HOP: 'Bấm vào dòng — danh sách Tổng hợp',
  BAM_DONG_UY_THAC: 'Bấm vào dòng — Uỷ thác điều tra',
};

/** Khoá giao diện — danh sách TRẮNG: `GET /settings/giao-dien` chỉ trả những khoá này, mọi người dùng đăng nhập đọc được. */
export const KHOA_GIAO_DIEN: readonly string[] = Object.keys(BAM_DONG_MAC_DINH);

/** Giá trị hợp lệ theo khoá; khoá không có trong bảng này không bị ràng buộc bởi danh mục. */
export const GIA_TRI_HOP_LE_THEO_KHOA: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  KHOA_GIAO_DIEN.map((k) => [k, DANH_SACH_BAM_DONG_GIA_TRI]),
);
