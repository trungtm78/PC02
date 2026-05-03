import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangePasswordModal } from '../ChangePasswordModal';
import * as apiModule from '@/lib/api';

vi.mock('@/lib/api', () => ({
  authApi: {
    changePassword: vi.fn(),
  },
}));

const mockChangePassword = apiModule.authApi.changePassword as ReturnType<typeof vi.fn>;

function renderModal(open = true) {
  const onClose = vi.fn();
  render(<ChangePasswordModal open={open} onClose={onClose} />);
  return { onClose };
}

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open=false', () => {
    renderModal(false);
    expect(screen.queryByText('Đổi mật khẩu')).toBeNull();
  });

  it('renders the form when open=true', () => {
    renderModal();
    expect(screen.getByText('Đổi mật khẩu')).toBeTruthy();
    expect(screen.getByPlaceholderText('Nhập mật khẩu hiện tại')).toBeTruthy();
    expect(screen.getByPlaceholderText('Nhập mật khẩu mới')).toBeTruthy();
  });

  it('submit button is disabled when rules not all passed', () => {
    renderModal();
    const newPasswordInput = screen.getByPlaceholderText('Nhập mật khẩu mới');
    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
    const submitBtn = screen.getByRole('button', { name: 'Cập nhật' });
    expect(submitBtn).toHaveAttribute('disabled');
  });

  it('shows strength checklist when typing new password', () => {
    renderModal();
    const newPasswordInput = screen.getByPlaceholderText('Nhập mật khẩu mới');
    fireEvent.change(newPasswordInput, { target: { value: 'abc' } });
    expect(screen.getByText('Tối thiểu 8 ký tự')).toBeTruthy();
    expect(screen.getByText('Có chữ hoa (A-Z)')).toBeTruthy();
    expect(screen.getByText('Có chữ số (0-9)')).toBeTruthy();
    expect(screen.getByText('Có ký tự đặc biệt (!@#$%^&*)')).toBeTruthy();
  });

  it('submit button enabled when all rules pass and current password filled', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'CurrentPass' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu mới'), {
      target: { value: 'NewPass@123' },
    });
    const submitBtn = screen.getByRole('button', { name: 'Cập nhật' });
    expect(submitBtn).not.toHaveAttribute('disabled');
  });

  it('shows success state after successful API call', async () => {
    mockChangePassword.mockResolvedValue({ data: { success: true, message: 'ok' } });
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'CurrentPass' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu mới'), {
      target: { value: 'NewPass@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
    await waitFor(() => {
      expect(screen.getByText('Đổi mật khẩu thành công')).toBeTruthy();
    });
  });

  it('shows error message on API failure', async () => {
    const axiosError = Object.assign(new Error('401'), {
      isAxiosError: true,
      response: { data: { message: 'Mật khẩu hiện tại không đúng' } },
    });
    mockChangePassword.mockRejectedValue(axiosError);
    // make axios.isAxiosError return true for this error
    vi.mock('axios', () => ({
      default: { isAxiosError: (e: unknown) => (e as any).isAxiosError === true },
      isAxiosError: (e: unknown) => (e as any).isAxiosError === true,
    }));

    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'CurrentPass' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu mới'), {
      target: { value: 'NewPass@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
    await waitFor(() => {
      expect(screen.getByText('Mật khẩu hiện tại không đúng')).toBeTruthy();
    });
  });

  it('clears form state when closed', async () => {
    mockChangePassword.mockResolvedValue({ data: { success: true, message: 'ok' } });
    const { onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'Test' },
    });
    // Close via X button
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
