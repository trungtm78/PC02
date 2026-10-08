/**
 * Bề rộng cột "Thao tác" của các danh sách hồ sơ (Đơn thư, Vụ việc, Vụ án, Tổng hợp) — MỘT chỗ khai.
 *
 * Tính từ số đo trên Chrome thật (prod 19/09/2026), không đoán: một dòng có 5 nút (4 nút nhanh + nút ⋮ "Thao tác
 * khác"); trong ô 9rem = 144px (lề trái/phải 16px), nút ⋮ kết thúc ở 176px → ô cần 176 + 16 = 192px = 12rem.
 * Ô 9rem cũ (đặt khi còn 4 nút; nút In thêm ở #346) làm nút ⋮ tràn 32px đè lên chữ cột STT — anh chụp 19/09/2026.
 *
 * Thêm/bớt nút nhanh trong `row-actions.ts` → đo lại và sửa ở đây. Ca UAT `tests/e2e/cot-thao-tac-uat.e2e.spec.ts`
 * đo toạ độ từng nút trên cả bốn màn và đỏ khi có nút vượt khỏi ô.
 */
export const BE_RONG_COT_THAO_TAC = 'var(--be-rong-cot-thao-tac)';

/**
 * Biến CSS khai ở `index.css`: 12rem trên máy tính, 2.5rem ở ≤767px (nút ⋮ 2rem + lề `max-md:px-1` của ô 2×0.25rem = 2.5rem; cột khai `thuGonTrenDienThoai` nên chữ tiêu đề cũng ẩn) (điện thoại chỉ còn một nút ⋮ cỡ 44px — xem
 * `RowActions`). Dùng `var()` chứ không đọc `matchMedia` ở đây: cột đổi bề rộng ngay khi xoay màn hình mà không cần dựng
 * lại bảng, và `calc()` tổng bề rộng của `Table` nhận `var()` nguyên vẹn. Cột Thao tác `khongDoiBeRong` nên
 * `doBeRong()` (chỉ phân tích px/rem) không bao giờ đọc giá trị này.
 */
export const BIEN_CSS_BE_RONG_COT_THAO_TAC = '--be-rong-cot-thao-tac';
