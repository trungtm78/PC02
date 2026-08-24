/**
 * Neo hồi quy cho lỗi "đăng nhập im lặng" (production 2026-08-24).
 *
 * VÌ SAO PHẢI DỰNG CẢ COMPONENT: bộ ca kiểm của `resolveLoginRoute` là ca kiểm
 * HÀM THUẦN — nó xanh kể cả khi LoginPage bị hoàn tác về chuỗi `if` hai nhánh
 * cũ, vì không tệp kiểm nào nạp LoginPage. Lỗi thật nằm ở chỗ NỐI DÂY: máy chủ
 * trả `twoFaSetupToken`, component không có nhánh nào khớp, hàm kết thúc im
 * lặng, HTTP 200 nên cũng không có thông báo lỗi — nút Đăng nhập "không ăn".
 *
 * Đây đúng loại lỗi mà dự án từng mắc: ca kiểm đúng, nhưng đặt sai tầng. Xem
 * bản vá guard SSE (BUG-011) — ca kiểm cũ tự dựng payload mà token thật không
 * bao giờ mang, nên xanh trong khi tính năng hỏng.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

const loginMock = vi.fn();
vi.mock('@/lib/api', () => ({
  authApi: { login: (...args: unknown[]) => loginMock(...args) },
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: { setTokens: vi.fn() },
}));

import LoginPage from '../LoginPage';
import { authStore } from '@/stores/auth.store';

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function submitLogin() {
  const [username, password] = screen.getAllByRole('textbox').length
    ? [screen.getAllByRole('textbox')[0], document.querySelector('input[type="password"]')!]
    : [];
  fireEvent.change(username as Element, { target: { value: 'nguoi.dung' } });
  fireEvent.change(password as Element, { target: { value: 'matkhau123' } });
  fireEvent.submit(document.querySelector('form')!);
}

describe('LoginPage — điều hướng sau đăng nhập (nối dây thật, không phải hàm thuần)', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    loginMock.mockReset();
    vi.mocked(authStore.setTokens).mockClear();
    localStorage.clear();
  });

  it('máy chủ đòi THIẾT LẬP 2 LỚP → sang /auth/2fa-setup (nhánh từng rơi vào im lặng)', async () => {
    loginMock.mockResolvedValue({
      data: { pending: true, twoFaSetupToken: 'setup-token', reason: 'TWO_FA_SETUP_REQUIRED' },
    });
    renderLogin();
    await submitLogin();

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        '/auth/2fa-setup',
        expect.objectContaining({ state: { twoFaSetupToken: 'setup-token' } }),
      ),
    );
  });

  it('máy chủ đòi ĐỔI MẬT KHẨU → sang trang đổi mật khẩu', async () => {
    loginMock.mockResolvedValue({
      data: { pending: true, changePasswordToken: 'cpt', reason: 'MUST_CHANGE_PASSWORD' },
    });
    renderLogin();
    await submitLogin();

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        '/auth/first-login-change-password',
        expect.objectContaining({ state: { changePasswordToken: 'cpt' } }),
      ),
    );
  });

  it('đăng nhập thẳng → lưu phiên và vào dashboard', async () => {
    loginMock.mockResolvedValue({
      data: { accessToken: 'at', refreshToken: 'rt', expiresIn: '15m' },
    });
    renderLogin();
    await submitLogin();

    await waitFor(() => expect(authStore.setTokens).toHaveBeenCalledWith('at', 'rt'));
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });

  // Chốt chặn CHÍNH của lớp lỗi: phản hồi lạ phải HIỆN LỖI, không được đứng im.
  it('phản hồi không nhận ra được → HIỆN LỖI, không im lặng, không điều hướng', async () => {
    loginMock.mockResolvedValue({ data: { pending: true, somethingNewToken: 'x' } });
    renderLogin();
    await submitLogin();

    const err = await screen.findByTestId('login-error');
    expect(err.textContent ?? '').toMatch(/không hỗ trợ|cập nhật/i);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(authStore.setTokens).not.toHaveBeenCalled();
  });
});
