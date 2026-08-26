/**
 * Lua chon nguoi dung trong cac o chon can bo tren form Don thu.
 *
 * Ten hien thi uu tien ho ten day du theo thu tu tieng Viet (ho truoc, ten sau); khong co
 * thi lui ve ten dang nhap de o chon khong bao gio trong.
 */
import { hoTen } from "@/lib/hoTen";

export interface UserOption {
  id: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

export function displayName(u: UserOption): string {
  const full = hoTen(u);
  return full || u.username;
}
