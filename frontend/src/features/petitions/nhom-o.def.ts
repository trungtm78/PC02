import type { NhomOKhai } from "@/components/legacy-form/NhomOGap";
import { laNguonTrucTiep } from "@/shared/nguon-don/truc-tiep";
import type { PetitionFormData } from "@/pages/petitions/PetitionFormPage/types";

/**
 * Nhóm ô gập được của form Đơn thư.
 *
 * Khai RIÊNG ở đây, KHÔNG thêm vào `features/cases/legacy-form-layout.def.ts`: đặc tả ấy dùng
 * chung cho cả Vụ án và Vụ việc (kiểm bằng danh sách import), nên gắn nhóm vào đó là đổi giao
 * diện hai màn anh không yêu cầu, và phải nới cổng `moiOCoChoLuu` ở cả ba form cùng lúc.
 *
 * Ràng buộc: các ô trong một nhóm phải LIỀN NHAU trong bố cục — cổng
 * `__tests__/nhomPhaiLienNhau.gate.test.ts` chặn. Bố cục là lưới phẳng hai cột đặt theo thứ
 * tự DOM, nên gom tập rời làm ô xen giữa phải dời và lệch cột mọi ô phía sau.
 */
export const NHOM_O_DON_THU: readonly NhomOKhai<PetitionFormData>[] = [
  {
    khoa: "dinh-danh-nguyen-don",
    nhan: "Thông tin định danh nguyên đơn",
    tab: "info",
    /*
      Yêu cầu 2 của anh: mấy ô CCCD rất ít được nhập, chỉ nhập khi nộp trực tiếp — gom lại để
      cán bộ khỏi Tab qua mỗi lần nhập một đơn.

      "Số điện thoại nguyên đơn" (`senderPhone`) ĐÃ RA KHỎI nhóm ngày 20/09/2026 theo yêu cầu
      của anh: nó dùng thường xuyên hơn hẳn cụm CCCD, và nó là ô BẮT BUỘC có điều kiện — để
      trong một khối gập là mời lại đúng lớp lỗi PR #248 (chặn Lưu bằng ô không nhìn thấy).
      Cổng `__tests__/oBatBuocKhongTrongNhom.gate.test.ts` khoá điều đó lại.

      Dải còn lại là 168→171 trong đặc tả — VẪN LIỀN NHAU, nên không ô nào phải dời chỗ và
      cổng `nhomPhaiLienNhau` vẫn xanh. Vẫn CỐ Ý giữ "Sinh năm" (`senderBirthYear`, ô 168): bỏ
      nó ra là gom một tập RỜI, mà bố cục là lưới phẳng hai cột đặt theo thứ tự DOM nên ô xen
      giữa buộc phải dời và thẻ nhóm chiếm trọn bề ngang còn làm lệch cột mọi ô phía sau.
      "Sinh năm nguyên đơn" vốn cũng là thông tin định danh nên vào nhóm là đúng nghĩa.
    */
    o: [
      "senderBirthYear",
      "senderIdNumber",
      "senderIdIssueDate",
      "senderIdIssuePlace",
    ],
    // Bung khi người nộp đứng trước mặt — đúng lúc mấy ô này lấy được dữ liệu. Hai lưới an
    // toàn còn lại (ô đã có giá trị, ô đang báo lỗi) do `LegacyLayoutSection` lo.
    moKhi: (fd) => laNguonTrucTiep(fd.nguonDon),
  },
  {
    khoa: "thong-tin-khac",
    nhan: "Thông tin khác",
    // CHỈ tab Thông tin. Hai ô này có bản gương ở 5 tab khác, và tab "subjects" chỉ có MỘT
    // trong hai — gom ở đó là gom một tập không đầy đủ.
    tab: "info",
    // Yêu cầu 5 của anh: hai ô này rất ít khi nhập, để mở sẵn thì cán bộ phải cuộn và Tab qua
    // mỗi lần nhập một đơn. Chúng là ô CHỮ TỰ DO (cột `dieuTraVien`, `lanhDaoToTung` kiểu
    // String), không phải ô chọn người — đổi sang chọn người là một đợt di trú riêng.
    o: ["dieuTraVien", "lanhDaoToTung"],
  },
];
