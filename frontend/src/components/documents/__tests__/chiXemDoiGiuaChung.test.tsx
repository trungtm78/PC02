/**
 * Chế độ xem BẬT SAU KHI khối tải tệp đã mở (Codex bắt trên PR chế độ xem Đơn thư): khối form tải lên chỉ ẩn NÚT MỞ
 * khi `chiXem`, còn khối đã mở thì vẫn hiển thị và dùng được — vẫn gửi `POST /documents`. Gặp khi mở form sửa, bấm
 * "Tải lên tài liệu", rồi bấm Back về màn xem (React giữ nguyên state của cùng một component).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EntityDocumentsTab } from '../EntityDocumentsTab';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: (...a: unknown[]) => apiDelete(...a),
  },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }], isLoading: false }),
}));

function dung(chiXem: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (cx: boolean) => (
    <QueryClientProvider client={qc}>
      <EntityDocumentsTab entityKind="petition" entityId="p1" chiXem={cx} />
    </QueryClientProvider>
  );
  const r = render(ui(chiXem));
  return { ...r, doiChiXem: (cx: boolean) => r.rerender(ui(cx)) };
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiDelete.mockReset();
  apiGet.mockResolvedValue({ data: { data: [{ id: 'd1', title: 'Biên bản', documentType: 'VAN_BAN' }] } });
});

describe('EntityDocumentsTab — chuyển sang chế độ xem khi form tải lên đang mở', () => {
  it('khối "Thêm tài liệu mới" biến mất ngay, không để lại ô nhập hay nút tải lên dùng được', async () => {
    const { doiChiXem } = dung(false);
    expect(await screen.findByText('Biên bản')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-mo-tai-len'));
    expect(screen.getByText('Thêm tài liệu mới')).toBeInTheDocument();

    doiChiXem(true);

    expect(screen.queryByText('Thêm tài liệu mới')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-mo-tai-len')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Biên bản khám nghiệm/)).not.toBeInTheDocument();
  });

  it('quay lại chế độ sửa thì form tải lên KHÔNG hiện lại với dữ liệu cũ của lần trước', async () => {
    const { doiChiXem } = dung(false);
    await screen.findByText('Biên bản');
    fireEvent.click(screen.getByTestId('btn-mo-tai-len'));
    fireEvent.change(screen.getByPlaceholderText(/Biên bản khám nghiệm/), { target: { value: 'Tiêu đề dở dang' } });

    doiChiXem(true);
    doiChiXem(false);

    // Form đã đóng (phải bấm mở lại), và không mang tiêu đề dở dang sang lần sau.
    expect(screen.queryByText('Thêm tài liệu mới')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-mo-tai-len'));
    expect((screen.getByPlaceholderText(/Biên bản khám nghiệm/) as HTMLInputElement).value).toBe('');
  });

  it('chế độ xem không bao giờ gửi POST/DELETE dù lời gọi xử lý còn sống', async () => {
    const { doiChiXem } = dung(false);
    await screen.findByText('Biên bản');
    doiChiXem(true);
    await waitFor(() => expect(screen.queryByTitle('Xóa')).not.toBeInTheDocument());
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
  });
});
