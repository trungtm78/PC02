import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useXoaKhoDemKhiDoiTaiKhoan } from '../useXoaKhoDemKhiDoiTaiKhoan';
import { TOKEN_EVENT } from '@/stores/auth.store';

/**
 * Kho đệm react-query phải bị XOÁ khi đổi tài khoản trong cùng một tab.
 *
 * ── Lỗi có thật, và nó rò dữ liệu giữa người dùng ──
 *
 * `queryClient` là một thể duy nhất ở gốc ứng dụng, còn `clearTokens()` chỉ xoá token — không
 * đụng kho đệm. Các khoá truy vấn theo-người-dùng (`user-table-layouts`,
 * `user-export-preferences`) KHÔNG kẹp danh tính, nên hai cán bộ dùng chung một máy: người trước
 * đăng xuất, người sau đăng nhập, và trong khoảng `staleTime` người sau đọc trúng dữ liệu của
 * người trước — bố cục cột, và nay là cả lựa chọn in chứng từ.
 *
 * Sửa ở GỐC — xoá kho đệm một lần khi token biến mất — thay vì kẹp danh tính vào từng khoá: kẹp
 * từng khoá là mỗi tính năng mới lại một chỗ để quên.
 */
function boc(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function dungKho() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['user-export-preferences'], { DON_THU: { templateIds: ['t1'], mode: 'zip' } });
  qc.setQueryData(['user-table-layouts'], { petitions: { code: { hidden: true } } });
  return qc;
}

describe('useXoaKhoDemKhiDoiTaiKhoan', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('token biến mất → xoá sạch kho đệm', () => {
    const qc = dungKho();
    renderHook(() => useXoaKhoDemKhiDoiTaiKhoan(), { wrapper: boc(qc) });
    act(() => {
      window.dispatchEvent(new CustomEvent(TOKEN_EVENT));
    });
    expect(qc.getQueryData(['user-export-preferences'])).toBeUndefined();
    expect(qc.getQueryData(['user-table-layouts'])).toBeUndefined();
  });

  /** Đang đăng nhập mà xoá kho đệm là bắt tải lại toàn bộ màn hình vô cớ. */
  it('vẫn còn token → KHÔNG xoá', () => {
    sessionStorage.setItem('accessToken', 'abc');
    const qc = dungKho();
    renderHook(() => useXoaKhoDemKhiDoiTaiKhoan(), { wrapper: boc(qc) });
    act(() => {
      window.dispatchEvent(new CustomEvent(TOKEN_EVENT));
    });
    expect(qc.getQueryData(['user-export-preferences'])).toBeDefined();
  });

  it('gỡ khỏi màn hình thì thôi nghe, không rò trình nghe', () => {
    const qc = dungKho();
    const { unmount } = renderHook(() => useXoaKhoDemKhiDoiTaiKhoan(), { wrapper: boc(qc) });
    unmount();
    act(() => {
      window.dispatchEvent(new CustomEvent(TOKEN_EVENT));
    });
    expect(qc.getQueryData(['user-export-preferences'])).toBeDefined();
  });
});
