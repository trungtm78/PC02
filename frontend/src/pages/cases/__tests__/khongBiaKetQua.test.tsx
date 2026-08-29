import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CaseDetailPage from '../CaseDetailPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as Record<'get' | 'post' | 'put', ReturnType<typeof vi.fn>>;

/**
 * Giao diện KHÔNG được tự bịa ra kết quả thành công.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, tab "Kết luận điều tra", chặn ghi ngay trước khi tới máy chủ (nên không có
 * gì được lưu):
 *
 *     popup con mo              : 0      ← popup đóng như đã lưu
 *     hop thoai                 : []     ← không báo gì
 *     co bao loi                : false
 *     noi dung vua go co hien ra: true   ← kết luận HIỆN RA trên màn
 *
 * Mã cố ý làm vậy:
 *
 *     } catch {
 *       // silently fail — keep UI state
 *       setConclusions((prev) => editingConclusion ? prev.map(...) : [...prev, c]);
 *     }
 *     setShowConclusionModal(false);
 *
 * Tệ hơn lớp "báo thành công giả" đã vá ở PR #321: chỗ đó chỉ NÓI thành công, chỗ này DỰNG RA
 * kết quả thành công. Cán bộ nhìn thấy Kết luận điều tra của mình nằm trong danh sách; tải lại
 * trang thì mất. Kết luận điều tra là văn bản tố tụng, không phải ghi chú nháp.
 *
 * Luật: thất bại thì KHÔNG chèn bản ghi, KHÔNG đóng popup, và phải nói ra lý do.
 */
function dung() {
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

/**
 * Lỗi phải mang hình dạng THẬT của axios: `extractApiError` gạn bằng `axios.isAxiosError`,
 * nên một object trần sẽ rơi xuống câu mặc định và ca kiểm đỏ vì lý do sai.
 */
const LOI = {
  isAxiosError: true,
  response: {
    status: 400,
    data: { success: false, error: { code: 'BAD_REQUEST', message: 'Máy chủ từ chối', details: [] } },
  },
};

describe('Kết luận điều tra — lưu thất bại', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.get.mockResolvedValue({ data: { data: [], id: 'c1', code: 'VA-1', name: 'Vụ án 1' } });
  });

  async function moTabKetLuan() {
    dung();
    const tab = await screen.findByText(/Kết luận điều tra/, {}, { timeout: 5000 });
    fireEvent.click(tab);
    const them = await screen.findByText(/Thêm kết luận/, {}, { timeout: 5000 });
    fireEvent.click(them);
  }

  it('KHÔNG chèn kết luận vào danh sách khi máy chủ từ chối', async () => {
    m.post.mockRejectedValue(LOI);
    await moTabKetLuan();
    const o = screen.getAllByRole('textbox');
    o.forEach((e) => fireEvent.change(e, { target: { value: 'NOI DUNG KIEM THU' } }));
    fireEvent.click(screen.getByTestId('btn-save-conclusion'));
    await waitFor(() => expect(m.post).toHaveBeenCalled());
    expect(screen.queryAllByText(/NOI DUNG KIEM THU/).length).toBeLessThanOrEqual(1);
  });

  it('KHÔNG đóng popup khi máy chủ từ chối', async () => {
    m.post.mockRejectedValue(LOI);
    await moTabKetLuan();
    screen.getAllByRole('textbox').forEach((e) =>
      fireEvent.change(e, { target: { value: 'abc' } }),
    );
    fireEvent.click(screen.getByTestId('btn-save-conclusion'));
    await waitFor(() => expect(m.post).toHaveBeenCalled());
    expect(screen.getByTestId('btn-save-conclusion')).toBeInTheDocument();
  });

  it('nói rõ lý do máy chủ từ chối', async () => {
    m.post.mockRejectedValue(LOI);
    await moTabKetLuan();
    screen.getAllByRole('textbox').forEach((e) =>
      fireEvent.change(e, { target: { value: 'abc' } }),
    );
    fireEvent.click(screen.getByTestId('btn-save-conclusion'));
    expect(await screen.findByTestId('conclusion-error')).toHaveTextContent(/Máy chủ từ chối/);
  });

  it('lưu thành công thì vẫn đóng popup như cũ', async () => {
    m.post.mockResolvedValue({ data: {} });
    await moTabKetLuan();
    screen.getAllByRole('textbox').forEach((e) =>
      fireEvent.change(e, { target: { value: 'abc' } }),
    );
    fireEvent.click(screen.getByTestId('btn-save-conclusion'));
    await waitFor(() =>
      expect(screen.queryByTestId('btn-save-conclusion')).not.toBeInTheDocument(),
    );
  });
});
