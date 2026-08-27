/**
 * Kiem du lieu form Vu viec truoc khi luu.
 *
 * Tra danh sach loi theo DUNG THU TU HIEN THI tren form (tren -> duoi) de dua con tro vao o
 * loi dau tien khi bam Luu, va de phim tat "loi tiep theo" nhay dung o ke.
 *
 * Tach khoi than trang de kiem duoc ma khong phai dung ca trang.
 */
import type { IncidentFormData } from './incident-form.types';

export function computeIncidentErrors(formData: IncidentFormData): {
  msgs: string[];
  fields: string[];
} {
  const items: { msg: string; testid: string }[] = [];
  // Phép kiểm trỏ vào ô "Tóm tắt nội dung" — ô DUY NHẤT cán bộ nhìn thấy. Máy chủ đòi `name`
  // ≥5 ký tự, nhưng `name` nay được suy từ chính ô ấy (xem `buildIncidentPayload`), nên báo
  // lỗi về "Tên vụ việc" là chỉ vào một ô không tồn tại trên màn hình.
  const noiDung = formData.description.trim() || formData.name.trim();
  if (noiDung.length < 5)
    items.push({ msg: "Tóm tắt nội dung phải có ít nhất 5 ký tự", testid: "field-description" });
  if (formData.fromDate && formData.toDate && new Date(formData.fromDate) > new Date(formData.toDate))
    items.push({ msg: "Từ ngày không được lớn hơn Đến ngày (EC-05)", testid: "field-fromDate" });
  return { msgs: items.map((i) => i.msg), fields: items.map((i) => i.testid) };
}
