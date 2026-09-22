import { dichLuu } from "./legacy-form-binding";
import type { CaseFieldPath } from "@/features/cases/legacy-form-layout.def";

/**
 * Ô của bố cục hệ cũ KHÔNG dựng trên form Đơn thư.
 *
 * Anh yêu cầu (20/09/2026, bổ sung 22/09/2026) bỏ những ô này khỏi màn tạo mới/sửa Đơn thư. "Bỏ" ở đây là THÔI HIỆN,
 * không phải xoá dữ liệu — anh đã chốt giữ nguyên: 15.185 đơn có "Tội danh cũ trước đây", 655
 * có "Nghi vấn đối tượng hoặc bị can", 141 có "Nơi xảy ra tội phạm". Tất cả vẫn in ra chứng
 * từ, vẫn tìm được, và đảo lại chỉ là xoá ba dòng khỏi mảng dưới.
 *
 * Khai RIÊNG cho Đơn thư, KHÔNG gỡ khỏi `features/cases/legacy-form-layout.def.ts`: đặc tả ấy
 * dùng chung cho cả Vụ án và Vụ việc, nên gỡ là mất ô ở hai màn anh không yêu cầu; `moiOCoChoLuu`
 * cũng đỏ ngay; và cột rơi khỏi `ownedColumns` thì panel "Thông tin nghiệp vụ bổ sung (di trú)"
 * TỰ DỰNG LẠI chính ô ấy — ẩn đi lại mọc ra chỗ khác, dưới một cái tên xấu hơn.
 *
 * Áp cho MỌI TAB: `nghiVanDoiTuong` và `toiDanhBanDau` còn có bản gương ở `incident-tdc` /
 * `case-tdc`; ẩn mỗi tab Thông tin thì cán bộ vẫn sửa được ở tab khác — ẩn nửa vời mà trông
 * như đã xong.
 */
/**
 * Tên ô theo ĐẶC TẢ hệ cũ — dùng cho mọi mệnh đề đối chiếu với đặc tả.
 *
 * Xuất ra để cổng `__tests__/oAnKhoiDonThu.gate.test.ts` khẳng định ba ô vẫn CÒN trong đặc tả
 * (Vụ án/Vụ việc không mất ô) mà không phải chép tay lần thứ hai.
 */
export const KHOA_HE_CU_DA_AN: readonly CaseFieldPath[] = [
  "nghiVanDoiTuong",
  "toiDanhBanDau",
  "noiXayRa",
  /*
    Thêm 22/09/2026 theo yêu cầu của anh: bỏ "Đồ vật, tài liệu kèm theo" khỏi form Đơn thư.

    Cùng luật với ba ô trên — THÔI HIỆN, không xoá: 11.591 hồ sơ đang có `attachmentsNote`.
    Đường IN giữ nguyên (`document-templates/field-catalog.ts` và `khoa-he-cu.ts` vẫn đọc cột),
    nên hồ sơ cũ in ra vẫn đủ chữ.

    HỆ QUẢ ĐÃ NHẬN, ghi ra đây để sau không ai đọc nhầm là lỗi: hồ sơ tạo TỪ NAY không còn chỗ
    nhập ô này, nên chỗ ấy trên bản in sẽ trống. Đó đúng là điều anh yêu cầu (bỏ ô nhập), không
    phải hồi quy.
  */
  "doVatTaiLieuKemTheo",
];

/**
 * Dịch qua `dichLuu` chứ KHÔNG chép tay tên ô.
 *
 * Form Đơn thư đổi tên vài ô của đặc tả: `nghiVanDoiTuong` thành `suspectedPerson`. Chép tay
 * tên hệ cũ thì ô ấy vẫn dựng ra như thường, mà mọi cổng đọc đặc tả vẫn xanh — đúng kiểu hỏng
 * im lặng. Bản đầu của tệp này mắc đúng lỗi ấy, cổng dựng-thật bắt được.
 */
export const O_AN_KHOI_DON_THU: readonly string[] = KHOA_HE_CU_DA_AN.map(
  (k) => dichLuu(k) as string,
);
