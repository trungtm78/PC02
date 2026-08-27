/**
 * Kiem tra du lieu form Don thu truoc khi luu.
 *
 * Tra danh sach loi theo DUNG THU TU HIEN THI tren form (tren -> duoi) de: (1) dua con tro
 * vao o loi dau tien khi bam Luu, (2) phim tat "loi tiep theo" nhay dung o ke.
 *
 * Tach khoi than trang de kiem duoc ma khong phai dung ca trang 1.167 dong.
 */
import { LoaiDon } from "@/shared/enums/generated";
import { today } from "@/lib/dates";
import type { PetitionFormData } from "./types";

const VALID_PETITION_TYPES = Object.values(LoaiDon) as string[];

/** Dinh dang email va so dien thoai Viet Nam (10 so, bat dau bang 0). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^0\d{9}$/;
/**
 * @param laHoSoDiTru ho so chuyen tu he cu sang (co `legacyRaw`). O "Loai don thu" duoc mien
 *   voi nhom nay: he cu KHONG CO khai niem ay nen ca 46.499 ho so deu de trong, do tren may
 *   chay 27/08/2026. Bat buoc no nghia la can bo mo bat ky ho so cu nao ra cung phai phan
 *   loai lai truoc khi sua noi mot dau phay, va phai tu phan doan phap ly - "To giac" cua he
 *   cu (21.662 ho so) khong dong nghia voi TO_CAO theo Luat To cao 2018.
 *
 *   Nguyen tac cua epic la can bo dung he cu KHONG PHAI HOC LAI; dung them mot cua ma he cu
 *   chua tung co la di nguoc dung nguyen tac ay. Don TAO MOI van bat buoc.
 */
export function computeFormErrors(
  fd: PetitionFormData,
  effectiveEdit: boolean,
  laHoSoDiTru = false,
): { msgs: string[]; fields: string[] } {
  const items: { msg: string; testid: string }[] = [];
  const anon = fd.senderIsAnonymous;
  if (!fd.receivedDate) items.push({ msg: "Ngày tiếp nhận là bắt buộc", testid: "field-receivedDate" });
  else if (fd.receivedDate > today())
    items.push({ msg: "Ngày tiếp nhận không được là ngày tương lai", testid: "field-receivedDate" });
  if (!anon && !fd.senderName.trim()) items.push({ msg: "Tên người gửi là bắt buộc", testid: "field-senderName" });
  if (!anon && !fd.senderAddress.trim()) items.push({ msg: "Địa chỉ người gửi là bắt buộc", testid: "field-senderAddress" });
  if (!effectiveEdit && !anon && !fd.senderPhone.trim())
    items.push({ msg: "Số điện thoại nguyên đơn là bắt buộc (trừ đơn nặc danh)", testid: "field-senderPhone" });
  else if (fd.senderPhone && !PHONE_RE.test(fd.senderPhone))
    items.push({ msg: "Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 0)", testid: "field-senderPhone" });
  if (fd.senderEmail && !EMAIL_RE.test(fd.senderEmail)) items.push({ msg: "Email không đúng định dạng", testid: "field-senderEmail" });
  // Mien vi he cu KHONG CO gia tri, khong phai vi ho so cu thi ghi gi cung duoc: can bo da
  // chon mot loai thi loai ay van phai hop le.
  const mienLoaiDon = laHoSoDiTru && !fd.petitionType;
  if (!mienLoaiDon && (!fd.petitionType || !VALID_PETITION_TYPES.includes(fd.petitionType)))
    items.push({ msg: "Loại đơn thư là bắt buộc", testid: "field-petitionType" });
  if (!effectiveEdit && !anon && !fd.crimeChinhId)
    items.push({ msg: "Tội danh chính là bắt buộc (trừ đơn nặc danh)", testid: "field-crimeChinhId" });
  if (!fd.detailContent.trim()) items.push({ msg: "Nội dung là bắt buộc", testid: "field-detailContent" });
  return { msgs: items.map((i) => i.msg), fields: items.map((i) => i.testid) };
}
