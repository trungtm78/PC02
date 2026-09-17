import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import InvestigationDelegationPage from '../InvestigationDelegationPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

const UY_THAC = {
  id: 'd1',
  delegationNumber: 'UT-001/2026',
  delegationDate: '2026-09-01T00:00:00.000Z',
  receivingUnit: 'Công an Quận 1',
  status: 'RECEIVED',
  content: 'Xác minh nhân thân đối tượng',
  createdBy: null,
  relatedCase: { name: 'Trộm cắp tài sản' },
};

function dung() {
  m.get.mockImplementation((url: string) =>
    Promise.resolve(
      url.startsWith('/delegations/stats')
        ? { data: { total: 1, byStatus: { RECEIVED: 1 } } }
        : { data: { data: [UY_THAC], total: 1 } },
    ),
  );
  const router = createMemoryRouter([{ path: '/', element: <InvestigationDelegationPage /> }]);
  return render(<RouterProvider router={router} />);
}

async function dienFormTaoMoi() {
  fireEvent.click(await screen.findByTestId('create-delegation-btn'));
  fireEvent.change(await screen.findByTestId('delegation-number-input'), {
    target: { value: 'UT-009/2026' },
  });
  fireEvent.change(screen.getByTestId('delegation-content-textarea'), {
    target: { value: 'Nội dung ủy thác đủ dài' },
  });
  fireEvent.change(screen.getByTestId('receiving-unit-select'), {
    target: { value: 'Công an Quận 1' },
  });
}

/**
 * Lưu ủy thác (rà mã 17/09/2026): tạo mới luôn 400 — màn gửi trạng thái chữ thường (`pending`) trong khi
 * DTO kiểm `@IsEnum(DelegationStatus)` (PENDING…), và gửi khoá `relatedCase` mà DTO không có
 * (`forbidNonWhitelisted`). Lỗi bị nuốt, modal đứng im. Prod có đúng 0 ủy thác.
 */
describe('Ủy thác điều tra — lưu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tạo mới gửi trạng thái theo MÃ enum và KHÔNG gửi khoá lạ `relatedCase`', async () => {
    m.post.mockResolvedValue({ data: { success: true } });
    dung();
    await dienFormTaoMoi();
    fireEvent.click(screen.getByTestId('save-delegation-btn'));
    await waitFor(() => expect(m.post).toHaveBeenCalled());
    const [url, body] = m.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/delegations');
    expect(body.status).toBe('PENDING');
    expect(body).not.toHaveProperty('relatedCase');
  });

  it('sửa gửi trạng thái theo MÃ enum', async () => {
    m.put.mockResolvedValue({ data: { success: true } });
    dung();
    fireEvent.click(await screen.findByTestId('edit-delegation-d1'));
    fireEvent.click(await screen.findByTestId('save-delegation-btn'));
    await waitFor(() => expect(m.put).toHaveBeenCalled());
    const body = m.put.mock.calls[0][1] as Record<string, unknown>;
    expect(body.status).toBe('RECEIVED');
    expect(body).not.toHaveProperty('relatedCase');
  });

  it('lưu lỗi khác 409 → NÓI ra lý do máy chủ đưa, không im lặng', async () => {
    m.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 500,
        data: { success: false, error: { code: 'INTERNAL', message: 'Máy chủ bận', details: [] } },
      },
    });
    dung();
    await dienFormTaoMoi();
    fireEvent.click(screen.getByTestId('save-delegation-btn'));
    expect(await screen.findByTestId('delegation-save-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('delegation-modal')).toBeInTheDocument();
  });

  /** API chỉ nhận `relatedCaseId`; tên gõ tay không lưu được — ô chỉ HIỂN THỊ liên kết đã có. */
  it('ô Vụ án liên quan chỉ hiển thị, không cho gõ', async () => {
    dung();
    fireEvent.click(await screen.findByTestId('edit-delegation-d1'));
    const o = await screen.findByTestId('related-case-input');
    expect(o).toHaveAttribute('readonly');
    expect(o).toHaveValue('Trộm cắp tài sản');
  });

  it('nhãn trạng thái thống nhất: bảng, bộ lọc và thẻ thống kê cùng gọi "Chờ nhận"', async () => {
    m.get.mockImplementation((url: string) =>
      Promise.resolve(
        url.startsWith('/delegations/stats')
          ? { data: { total: 1, byStatus: { PENDING: 1 } } }
          : { data: { data: [{ ...UY_THAC, status: 'PENDING' }], total: 1 } },
      ),
    );
    const router = createMemoryRouter([{ path: '/', element: <InvestigationDelegationPage /> }]);
    render(<RouterProvider router={router} />);
    await screen.findByTestId('view-delegation-d1');
    expect(screen.queryByText('Chờ xử lý')).not.toBeInTheDocument();
  });
});
