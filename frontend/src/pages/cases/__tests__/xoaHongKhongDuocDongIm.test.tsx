import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InitialCasesPage from '../InitialCasesPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as Record<'get' | 'delete', ReturnType<typeof vi.fn>>;

/**
 * Xoá THẤT BẠI thì hộp xác nhận phải ở lại và nói ra lý do.
 *
 * Bản trước đóng hộp ở CẢ HAI nhánh:
 *
 *     try  { await api.delete(...); setCases(...); closeDeleteDialog(); }
 *     catch { closeDeleteDialog(); }
 *
 * Nên xoá hỏng nhìn y hệt xoá xong: hộp biến mất, không thông báo nào. Hồ sơ vẫn còn trong danh
 * sách — nhưng cán bộ đã tin là đã xoá và không nhìn lại. Khác với hai tab kế hoạch/biên bản
 * (bịa ra việc đã xoá), ở đây dữ liệu đúng còn PHẢN HỒI sai; hậu quả với người dùng như nhau.
 */
const HO_SO = [
  {
    id: 'c1',
    caseNumber: 'VA-2026-001',
    subject: 'Nội dung vụ án',
    status: 'NEW',
    receivedDate: '2026-01-01',
    deadline: null,
    assignee: null,
    source: null,
    priority: null,
  },
];

const LOI = {
  isAxiosError: true,
  response: {
    status: 409,
    data: { success: false, error: { code: 'CONFLICT', message: 'Hồ sơ đang được xử lý', details: [] } },
  },
};

function dung() {
  return render(
    <MemoryRouter>
      <InitialCasesPage />
    </MemoryRouter>,
  );
}

describe('InitialCasesPage — xoá thất bại', () => {
  beforeEach(() => vi.clearAllMocks());

  async function moHopXoa() {
    m.get.mockResolvedValue({ data: { data: HO_SO } });
    dung();
    const nut = await screen.findByTestId('btn-delete-c1', {}, { timeout: 5000 });
    fireEvent.click(nut);
    await screen.findByTestId('delete-dialog');
  }

  it('hộp xác nhận vẫn mở khi máy chủ từ chối', async () => {
    m.delete.mockRejectedValue(LOI);
    await moHopXoa();
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(m.delete).toHaveBeenCalled());
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });

  it('nói rõ lý do máy chủ từ chối', async () => {
    m.delete.mockRejectedValue(LOI);
    await moHopXoa();
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(await screen.findByTestId('initial-delete-error')).toHaveTextContent(
      /Hồ sơ đang được xử lý/,
    );
  });

  it('xoá thành công thì hộp đóng như cũ', async () => {
    m.delete.mockResolvedValue({ data: {} });
    await moHopXoa();
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument());
  });
});
