/**
 * "Làm trống form và nhập lại từ đầu" (phím tắt F8) trên màn Đơn thư.
 *
 * Tách khỏi `index.tsx` vì một lẽ: ở trong đó nó là hàm mũi tên nằm giữa một trang 1.300 dòng,
 * và phím tắt chạy qua `react-hotkeys-hook` nên ca kiểm không chạm tới được — đúng chỗ lỗi dưới
 * đây sống sót.
 *
 * LỖI ĐANG SỬA (lượt soát mô hình ngoài 22/09/2026): `window.location.reload()` GIỮ NGUYÊN
 * history state. Sau khi bấm "Tạo đơn mới từ đơn này", mầm chép nằm ở `location.state.chepTu`;
 * bấm F8 để làm trống thì trang dựng lại vẫn đọc mầm ấy và nội dung đơn cũ hiện về nguyên vẹn —
 * nút làm trống không làm trống được gì, và cán bộ không có cách nào thoát ra ngoài việc gõ tay
 * lại URL.
 */
export interface LamTrongFormDeps {
  /** Đang SỬA một hồ sơ đã có (khác với TẠO mới). */
  isEditMode: boolean;
  /** Hỏi cán bộ trước khi bỏ dữ liệu chưa lưu. */
  xacNhan: () => boolean;
  diToi: (to: string, tuyChon?: { replace?: boolean; state?: unknown }) => void;
  taiLai: () => void;
}

export function lamTrongForm({ isEditMode, xacNhan, diToi, taiLai }: LamTrongFormDeps): void {
  if (!xacNhan()) return;

  // SỬA → sang route tạo mới. Không tải lại tại chỗ: ghi đè bản ghi cũ bằng dữ liệu trắng.
  if (isEditMode) {
    diToi('/petitions/new', { state: null });
    return;
  }

  // TẠO MỚI → xoá mầm chép RỒI tải lại. Tải lại (thay vì đặt lại state bằng tay) là để xoá sạch
  // mọi state phụ, kể cả tệp đã đính vào hàng đợi — đặt lại tay thì sót, và sót im lặng.
  diToi('.', { replace: true, state: null });
  taiLai();
}
