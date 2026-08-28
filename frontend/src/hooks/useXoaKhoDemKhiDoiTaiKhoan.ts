import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authStore, TOKEN_EVENT } from '@/stores/auth.store';

/**
 * Xoá kho đệm react-query khi token biến mất (đăng xuất, phiên hết hạn).
 *
 * ── Vì sao cần ──
 *
 * `queryClient` là MỘT thể duy nhất ở gốc ứng dụng, còn `clearTokens()` chỉ xoá token — không
 * đụng kho đệm. Các khoá truy vấn theo-người-dùng (`user-table-layouts`,
 * `user-export-preferences`) không kẹp danh tính, nên hai cán bộ dùng chung một máy: người trước
 * đăng xuất, người sau đăng nhập, và trong khoảng `staleTime` người sau đọc trúng dữ liệu của
 * người trước — bố cục cột, và cả lựa chọn in chứng từ.
 *
 * ── Vì sao sửa ở đây, không kẹp danh tính vào từng khoá ──
 *
 * Kẹp từng khoá là mỗi tính năng theo-người-dùng mới lại thêm một chỗ để quên, và quên thì hỏng
 * im lặng. Xoá một lần ở đúng ranh giới đổi tài khoản chặn cả lớp lỗi, kể cả cho tính năng chưa
 * viết.
 */
export function useXoaKhoDemKhiDoiTaiKhoan(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const nghe = () => {
      // Chỉ xoá khi KHÔNG còn token. Đăng nhập và làm mới token cũng phát sự kiện này; xoá lúc
      // ấy là bắt tải lại toàn bộ màn hình vô cớ.
      if (!authStore.getAccessToken()) qc.clear();
    };
    window.addEventListener(TOKEN_EVENT, nghe);
    return () => window.removeEventListener(TOKEN_EVENT, nghe);
  }, [qc]);
}
