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
  if (!formData.name.trim() || formData.name.length < 5)
    items.push({ msg: "Tên vụ việc phải có ít nhất 5 ký tự", testid: "field-name" });
  if (formData.fromDate && formData.toDate && new Date(formData.fromDate) > new Date(formData.toDate))
    items.push({ msg: "Từ ngày không được lớn hơn Đến ngày (EC-05)", testid: "field-fromDate" });
  return { msgs: items.map((i) => i.msg), fields: items.map((i) => i.testid) };
}
