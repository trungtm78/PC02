import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OfficerOption {
  value: string; // User.id
  label: string; // Họ và tên, lùi về username khi thiếu
}

/** Số cán bộ mỗi lần tải — trần `@Max(500)` của `QueryUsersDto`. */
const MOI_TRANG = 500;

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
      // Tải THEO TRANG tới khi đủ `total` (UAT prod 19/09/2026: 245 tài khoản đang hoạt động mà bản cũ cắt ở 200 →
      // ~45 cán bộ không lọc được). Máy chủ cho tối đa 500 dòng mỗi trang.
      type NguoiDung = { id: string; firstName?: string | null; lastName?: string | null; username?: string | null };
      const tatCa: NguoiDung[] = [];
      for (let offset = 0; ; offset += MOI_TRANG) {
        const res = await api.get('/admin/users', { params: { limit: MOI_TRANG, offset, status: 'active' } });
        const than = res.data as NguoiDung[] | { data?: NguoiDung[]; total?: number } | undefined;
        const trang = Array.isArray(than) ? than : (than?.data ?? []);
        tatCa.push(...trang);
        const tong = Array.isArray(than) ? tatCa.length : Number(than?.total ?? tatCa.length);
        if (trang.length < MOI_TRANG || tatCa.length >= tong) break;
      }

      const hoTen = (u: NguoiDung) => `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || (u.username ?? u.id);
      // Trùng họ tên (13 cặp trên prod, vd tài khoản cũ + tài khoản `.doi2`) → ghi kèm tên đăng nhập, không thì hai
      // dòng y hệt và chọn nhầm là lọc ra 0.
      const soLan = new Map<string, number>();
      for (const u of tatCa) soLan.set(hoTen(u), (soLan.get(hoTen(u)) ?? 0) + 1);
      return tatCa
        .map((u) => {
          const nhan = hoTen(u);
          return {
            value: u.id,
            label: (soLan.get(nhan) ?? 0) > 1 && u.username ? `${nhan} (${u.username})` : nhan,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'vi')) as OfficerOption[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}
