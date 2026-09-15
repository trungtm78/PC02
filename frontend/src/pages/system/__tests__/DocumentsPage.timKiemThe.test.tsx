import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocumentsPage from '../DocumentsPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const CO_TAT_THE: FeatureFlag[] = [
  {
    key: 'TIM_KIEM_THE',
    label: 'Tìm kiếm dạng thẻ',
    description: null,
    enabled: false,
    domain: null,
    rolloutPct: 100,
  },
];

const TAI_LIEU = {
  id: 'doc1',
  title: 'Biên bản khám nghiệm',
  originalName: 'bien-ban.pdf',
  description: 'Hiện trường',
  fileName: 'x.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  filePath: '/x',
  documentType: 'VAN_BAN',
  uploadedById: 'u1',
  createdAt: '2026-09-01T02:00:00.000Z',
  updatedAt: '2026-09-01T02:00:00.000Z',
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/documents')) {
      const data = rong ? [] : [TAI_LIEU];
      return Promise.resolve({
        data: { success: true, data, total: data.length, page: 1, pageSize: 20 },
      });
    }
    if (url.startsWith('/catalog/')) {
      return Promise.resolve({ data: [{ code: 'VAN_BAN', label: 'Văn bản' }] });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

/** Tham số (đã giải mã) của lượt gọi CUỐI tới `/documents`. */
function thamSoCuoi(): URLSearchParams {
  const goi = m.get.mock.calls
    .map((c) => (c as [string])[0])
    .filter((u) => u.startsWith('/documents'));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <DocumentsPage /> }], {
    initialEntries: [url],
  });
  const trang = (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: màn Tài liệu tìm ở MÁY CHỦ bằng thẻ (`tk`) — gõ không dấu, chọn cột (tiêu đề, tên tệp, mô tả,
 * loại, Vụ án/Vụ việc, người upload, ngày). Trước đây ô chữ gửi `search` và máy chủ so `contains`
 * thường, dù chỗ gợi ý ghi "hỗ trợ tìm kiếm không dấu".
 */
describe('DocumentsPage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('document-row-doc1');
    fireEvent.change(o, { target: { value: 'bien ban' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['*~bien ban']));
    expect(thamSoCuoi().get('search')).toBeNull();
    // Màn phân trang bằng limit/offset: thẻ mới luôn về trang đầu.
    expect(thamSoCuoi().get('offset')).toBe('0');
  });

  it('thẻ trên URL (`documents_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?documents_tk=tieuDe~bien ban');
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['tieuDe~bien ban']));
  });

  it('khoá lạ trên URL → thẻ đỏ, KHÔNG gửi (không 400 cả danh sách)', async () => {
    dung('/?documents_tk=khongCo~x');
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(thamSoCuoi().getAll('tk')).toEqual([]);
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?documents_tk=tieuDe~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    // Thẻ cũng hiện trên ô tìm — chỉ xét vùng "không tìm thấy".
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Tiêu đề' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('document-search-input');
    fireEvent.change(o, { target: { value: 'bien' } });
    await waitFor(() => expect(thamSoCuoi().get('search')).toBe('bien'));
    expect(thamSoCuoi().getAll('tk')).toEqual([]);
  });
});
