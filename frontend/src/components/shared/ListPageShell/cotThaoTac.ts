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
export const BE_RONG_COT_THAO_TAC = '12rem';
