/**
 * Trang chi tiết vụ án: người xem CHỈ ĐỌC được vụ án (vd điều phối viên xem vụ án tổ khác — quyết định 19/09/2026:
 * ngoài phạm vi chỉ xem + phân công) thì KHÔNG thấy nút ghi (Chỉnh sửa, Thêm bị can / luật sư / kết luận, sửa/xoá dòng).
 * Trước đây nút vẫn hiện, bấm → 403. Máy chủ trả `quyenGhi` theo đúng luật checkWriteScope (20/09/2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import CaseDetailPage from '../CaseDetailPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
}));
const m = vi.mocked(api) as unknown as Record<'get', ReturnType<typeof vi.fn>>;

function dung(quyenGhi: boolean) {
  m.get.mockImplementation((url: string) =>
    Promise.resolve(
      url === '/cases/c1'
        ? { data: { data: { id: 'c1', caseCode: '2026-1', name: 'Vụ án 1', status: 'TIEP_NHAN', quyenGhi } } }
        : { data: { data: [] } },
    ),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/cases/c1']}>
        <Routes>
          <Route path="/cases/:id" element={<CaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Chi tiết vụ án — chỉ xem thì ẩn nút ghi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('quyenGhi = false → không có Chỉnh sửa, không có Thêm kết luận; có nhãn Chỉ xem', async () => {
    dung(false);
    expect(await screen.findByTestId('nhan-chi-xem', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('btn-edit-case')).toBeNull();
    fireEvent.click(await screen.findByText(/Kết luận điều tra/));
    expect(screen.queryByTestId('btn-add-conclusion')).toBeNull();
  });

  it('quyenGhi = true → có Chỉnh sửa và Thêm kết luận, không có nhãn Chỉ xem', async () => {
    dung(true);
    expect(await screen.findByTestId('btn-edit-case', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByTestId('nhan-chi-xem')).toBeNull();
    fireEvent.click(await screen.findByText(/Kết luận điều tra/));
    expect(await screen.findByTestId('btn-add-conclusion')).toBeInTheDocument();
  });
});
