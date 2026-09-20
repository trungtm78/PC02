/**
 * Kiem tra du lieu form Don thu truoc khi luu.
 *
 * Tra danh sach loi theo DUNG THU TU HIEN THI tren form (tren -> duoi) de: (1) dua con tro
 * vao o loi dau tien khi bam Luu, (2) phim tat "loi tiep theo" nhay dung o ke.
 *
 * Tach khoi than trang de kiem duoc ma khong phai dung ca trang 1.167 dong.
 */
import { today } from "@/lib/dates";
import { laNguonTrucTiep } from "@/shared/nguon-don/truc-tiep";
import type { PetitionFormData } from "./types";

/** Dinh dang email va so dien thoai Viet Nam (10 so, bat dau bang 0). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^0\d{9}$/;
/**
 * Khong kiem "Loai thong tin": he cu khong bat buoc o ay, va nhom han giai quyet do may chu
 * suy tu danh muc Loai thong tin (14/09/2026 - go o "Loai don thu" rieng).
 */
export function computeFormErrors(
  fd: PetitionFormData,
  effectiveEdit: boolean,
): { msgs: string[]; fields: string[] } {
  const items: { msg: string; testid: string }[] = [];
  const anon = fd.senderIsAnonymous;
  if (!fd.receivedDate) items.push({ msg: "Ngày tiếp nhận là bắt buộc", testid: "field-receivedDate" });
  else if (fd.receivedDate > today())
    items.push({ msg: "Ngày tiếp nhận không được là ngày tương lai", testid: "field-receivedDate" });
  if (!anon && !fd.senderName.trim()) items.push({ msg: "Tên người gửi là bắt buộc", testid: "field-senderName" });
  if (!anon && !fd.senderAddress.trim()) items.push({ msg: "Địa chỉ người gửi là bắt buộc", testid: "field-senderAddress" });
  // SĐT nguyên đơn bắt buộc CÓ ĐIỀU KIỆN: chỉ khi người nộp đứng trước mặt. Đơn đến bằng bưu
  // điện hay do đơn vị khác chuyển thì không lấy được số, ép nhập là ép cán bộ BỊA.
  //
  // `laNguonTrucTiep` là ĐÚNG hàm máy chủ gọi ở `sdt-nguyen-don.validator.ts`, và cả hai đầu
  // đều bị chấm trên `shared/nguon-don/truc-tiep.corpus.json` — không thể lệch nhau.
  if (!effectiveEdit && !anon && laNguonTrucTiep(fd.nguonDon) && !fd.senderPhone.trim())
    items.push({
      msg: "Số điện thoại nguyên đơn là bắt buộc khi nguồn đơn là nộp trực tiếp",
      testid: "field-senderPhone",
    });
  else if (fd.senderPhone && !PHONE_RE.test(fd.senderPhone))
    items.push({ msg: "Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 0)", testid: "field-senderPhone" });
  if (fd.senderEmail && !EMAIL_RE.test(fd.senderEmail)) items.push({ msg: "Email không đúng định dạng", testid: "field-senderEmail" });
  if (!effectiveEdit && !anon && !fd.crimeChinhId)
    items.push({ msg: "Tội danh chính là bắt buộc (trừ đơn nặc danh)", testid: "field-crimeChinhId" });
  if (!fd.detailContent.trim()) items.push({ msg: "Nội dung là bắt buộc", testid: "field-detailContent" });
  return { msgs: items.map((i) => i.msg), fields: items.map((i) => i.testid) };
}
