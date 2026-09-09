import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OfficerOption {
  value: string; // User.id
  label: string; // Họ và tên, lùi về username khi thiếu
}

/**
 * Danh sách cán bộ cho ô lọc "Cán bộ nhập" — bảng lọc theo kiểu hệ cũ.
 *
 * Dùng `GET /admin/users`: tên endpoint nghe như chỉ dành cho quản trị, nhưng quyền thật
 * là `read:User` và **OFFICER cũng có** (kiểm trên cơ sở dữ liệu đang chạy 25/08/2026).
 * Nếu dùng nhầm một endpoint chỉ ADMIN mới gọi được thì ô lọc sẽ rỗng với đúng những
 * người cần nó nhất.
 *
 * `enabled` để trang chưa mở bảng lọc thì không tải — danh sách này không đổi theo phút.
 */
export function useOfficerOptions(enabled = true) {
  return useQuery({
    queryKey: ['officers', 'options'],
    queryFn: async () => {
      // Khoá lọc là `status: 'active'`, KHÔNG phải `isActive`.
      //
      // Máy chủ khai `QueryUsersDto` với `status` (rồi tự đổi thành `isActive` khi truy vấn) và
      // bật `forbidNonWhitelisted`, nên gửi `isActive` bị trả 400 "property isActive should not
      // exist" — ô lọc cán bộ RỖNG trên cả ba trang danh sách, im lặng. Monkey test bắt được
      // ngày 09/09/2026.
      const res = await api.get('/admin/users', { params: { limit: 200, status: 'active' } });
      const items: Array<{
        id: string;
        firstName?: string | null;
        lastName?: string | null;
        username?: string | null;
      }> = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);

      return items
        .map((u) => ({
          value: u.id,
          label: `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || (u.username ?? u.id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'vi')) as OfficerOption[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
