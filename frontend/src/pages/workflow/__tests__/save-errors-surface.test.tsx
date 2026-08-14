/**
 * Chốt chặn #4 của kế hoạch: `catch` trong handler lưu phải báo lỗi, không
 * được nuốt.
 *
 * Bốn handler lưu tự ghi trong comment rằng chúng cố tình im lặng — "keep modal
 * open on error", "silently fail", "silently fail — form stays open so user
 * sees no crash". Đây cùng một lớp lỗi với `alert("thành công")` giả: giao diện
 * nói dối, chỉ khác là nói dối bằng cách im. Chỗ tệ nhất (PetitionGuidancePage)
 * còn không `return` sau khi nuốt, nên lưu hỏng mà modal vẫn ĐÓNG — không phân
 * biệt được với lưu xong.
 *
 * Mỗi test dưới đây fail nếu bỏ phần báo lỗi vừa thêm.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { api } from '@/lib/api';
import PetitionGuidancePage from '../PetitionGuidancePage';
import InvestigationDelegationPage from '../InvestigationDelegationPage';
import CaseExchangePage from '../CaseExchangePage';

/** Lỗi axios thật, để `extractApiError` đọc được thông điệp của server. */
function apiError(message: string, status = 400) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { error: { message, details: [] } } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('PetitionGuidancePage — lưu hỏng', () => {
  async function fillAndSave() {
    render(<PetitionGuidancePage />);
    fireEvent.click(await screen.findByTestId('add-guidance-btn'));
    fireEvent.change(screen.getByPlaceholderText('Họ và tên công dân'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('VD: Hướng dẫn viết đơn tố cáo'), {
      target: { value: 'Hướng dẫn viết đơn' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập nội dung hướng dẫn chi tiết...'), {
      target: { value: 'Nội dung hướng dẫn đầy đủ.' },
    });
    fireEvent.click(screen.getByTestId('save-guidance-btn'));
  }

  it('hiện thông điệp lỗi của server thay vì im lặng', async () => {
    vi.mocked(api.post).mockRejectedValue(apiError('Ngoài phạm vi dữ liệu của bạn', 403));

    await fillAndSave();

    expect(await screen.findByTestId('guidance-save-error')).toHaveTextContent(
      'Ngoài phạm vi dữ liệu',
    );
  });

  it('KHÔNG đóng modal khi lưu hỏng', async () => {
    // Lỗi gốc: `catch` không `return`, nên chạy tiếp xuống `setShowGuidanceModal(false)`.
    // Modal đóng = người dùng đọc là "đã lưu".
    vi.mocked(api.post).mockRejectedValue(apiError('Trùng số phiếu', 409));

    await fillAndSave();

    await screen.findByTestId('guidance-save-error');
    expect(screen.getByTestId('save-guidance-btn')).toBeInTheDocument();
  });
});

describe('InvestigationDelegationPage — lưu hỏng', () => {
  it('hiện lỗi thay vì để nút Lưu trông như hỏng', async () => {
    vi.mocked(api.post).mockRejectedValue(apiError('Số ủy thác đã tồn tại', 409));
    render(<InvestigationDelegationPage />);

    fireEvent.click(await screen.findByTestId('create-delegation-btn'));
    const modal = await screen.findByTestId('delegation-modal');
    fireEvent.change(screen.getByPlaceholderText('UT-001/2026'), {
      target: { value: 'UT-001/2026' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Mô tả chi tiết công việc cần đơn vị nhận thực hiện...'),
      { target: { value: 'Nội dung ủy thác đủ dài để qua kiểm tra tối thiểu.' } },
    );
    for (const el of Array.from(modal.querySelectorAll('input[type="date"]'))) {
      fireEvent.change(el, { target: { value: '2026-08-01' } });
    }
    for (const el of Array.from(modal.querySelectorAll('select'))) {
      const opt = (el as HTMLSelectElement).options[1];
      if (opt) fireEvent.change(el, { target: { value: opt.value } });
    }
    fireEvent.click(screen.getByTestId('save-delegation-btn'));

    expect(await screen.findByTestId('delegation-save-error')).toHaveTextContent(
      'Số ủy thác đã tồn tại',
    );
  });
});

describe('CaseExchangePage — tạo trao đổi hỏng', () => {
  it('hiện lỗi và giữ modal mở', async () => {
    vi.mocked(api.post).mockRejectedValue(apiError('Đơn vị nhận không hợp lệ'));
    render(<CaseExchangePage />);

    fireEvent.click(await screen.findByTestId('create-exchange-btn'));
    const modal = await screen.findByTestId('exchange-modal');
    for (const el of Array.from(
      modal.querySelectorAll('input:not([type="file"]), textarea, select'),
    )) {
      const opt = el.tagName === 'SELECT' ? (el as HTMLSelectElement).options[1] : null;
      fireEvent.change(el, { target: { value: opt ? opt.value : 'HS-2026-001' } });
    }
    fireEvent.click(screen.getByTestId('submit-exchange-btn'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(await screen.findByTestId('exchange-submit-error')).toHaveTextContent(
      'Đơn vị nhận không hợp lệ',
    );
  });
});
