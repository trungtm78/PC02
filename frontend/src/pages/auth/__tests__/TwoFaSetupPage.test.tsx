/**
 * Ca kiểm cho trang thiết lập 2 lớp lần đầu — đích đến của bản vá
 * "238 tài khoản không đăng nhập được".
 *
 * Trọng tâm: MỌI đường đi đều phải có lối ra. Trang này thay thế một bế tắc im
 * lặng, nên bản thân nó tuyệt đối không được tạo ra một bế tắc mới.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const navigateSpy = vi.fn();
let locationState: unknown = { twoFaSetupToken: 'setup-token' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
    useLocation: () => ({ state: locationState, pathname: '/auth/2fa-setup' }),
  };
});

const initialSetupMock = vi.fn();
const completeMock = vi.fn();
vi.mock('@/lib/api', () => ({
  authApi: {
    initialTwoFaSetup: (...a: unknown[]) => initialSetupMock(...a),
    completeInitialTwoFaSetup: (...a: unknown[]) => completeMock(...a),
  },
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/stores/auth.store', () => ({ authStore: { setTokens: vi.fn() } }));

import TwoFaSetupPage from '../TwoFaSetupPage';
import { authStore } from '@/stores/auth.store';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TwoFaSetupPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const OK_SETUP = {
  data: { qrCodeDataUrl: 'data:image/png;base64,fake', backupCodes: ['aaa111', 'bbb222'] },
};

async function fillAndSubmit(code = '123456') {
  fireEvent.click(await screen.findByTestId('2fa-setup-ack'));
  fireEvent.change(screen.getByTestId('2fa-setup-code-input'), { target: { value: code } });
  fireEvent.submit(document.querySelector('form')!);
}

describe('TwoFaSetupPage', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    initialSetupMock.mockReset();
    completeMock.mockReset();
    vi.mocked(authStore.setTokens).mockClear();
    locationState = { twoFaSetupToken: 'setup-token' };
  });

  it('hiện mã QR và mã dự phòng lấy từ máy chủ', async () => {
    initialSetupMock.mockResolvedValue(OK_SETUP);
    renderPage();

    expect(await screen.findByTestId('2fa-setup-qr')).toBeTruthy();
    expect(screen.getByText('aaa111')).toBeTruthy();
    expect(initialSetupMock).toHaveBeenCalledWith('setup-token');
  });

  it('không được gửi khi CHƯA xác nhận đã lưu mã dự phòng', async () => {
    initialSetupMock.mockResolvedValue(OK_SETUP);
    renderPage();
    await screen.findByTestId('2fa-setup-qr');

    fireEvent.change(screen.getByTestId('2fa-setup-code-input'), { target: { value: '123456' } });
    const submit = screen.getByRole('button', { name: /hoàn tất/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('xác nhận xong, máy chủ trả cặp token → lưu phiên, vào dashboard', async () => {
    initialSetupMock.mockResolvedValue(OK_SETUP);
    completeMock.mockResolvedValue({
      data: { accessToken: 'at', refreshToken: 'rt', expiresIn: '15m' },
    });
    renderPage();
    await screen.findByTestId('2fa-setup-qr');
    await fillAndSubmit();

    await waitFor(() => expect(authStore.setTokens).toHaveBeenCalledWith('at', 'rt'));
    expect(navigateSpy).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  // Đây là ca của ĐA SỐ: tài khoản do quản trị tạo mang đồng thời hai cờ.
  it('máy chủ đòi đổi mật khẩu → sang trang đổi mật khẩu, KHÔNG lưu phiên', async () => {
    initialSetupMock.mockResolvedValue(OK_SETUP);
    completeMock.mockResolvedValue({
      data: { pending: true, changePasswordToken: 'cpt', reason: 'MUST_CHANGE_PASSWORD' },
    });
    renderPage();
    await screen.findByTestId('2fa-setup-qr');
    await fillAndSubmit();

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        '/auth/first-login-change-password',
        expect.objectContaining({ state: { changePasswordToken: 'cpt' } }),
      ),
    );
    expect(authStore.setTokens).not.toHaveBeenCalled();
  });

  it('vào thẳng URL mà không có token → đưa về trang đăng nhập, không dựng gì', async () => {
    locationState = null;
    renderPage();

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/login', { replace: true }));
    expect(initialSetupMock).not.toHaveBeenCalled();
  });

  // Chốt chặn lớp lỗi: màn hình lỗi PHẢI có đường đi tiếp.
  it('lỗi tải mã QR → hiện lỗi KÈM nút thử lại, không phải ngõ cụt', async () => {
    initialSetupMock.mockRejectedValue({ response: { status: 500 } });
    renderPage();

    expect(await screen.findByTestId('2fa-setup-retry')).toBeTruthy();
    expect(screen.getByTestId('2fa-setup-retry').textContent).toMatch(/thử lại/i);
  });

  it('phiên thiết lập hết hạn (401) → báo ĐÚNG nguyên nhân, không đổ lỗi mã sai', async () => {
    initialSetupMock.mockRejectedValue({ response: { status: 401 } });
    renderPage();

    const retry = await screen.findByTestId('2fa-setup-retry');
    expect(screen.getByRole('alert').textContent ?? '').toMatch(/hết hạn/i);
    expect(retry.textContent).toMatch(/đăng nhập/i);
  });
});
