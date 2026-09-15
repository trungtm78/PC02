import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DirectoriesPage from '../DirectoriesPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canView: () => true,
  }),
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

const MUC = {
  id: 'd1',
  type: 'CRIME',
  code: 'TH001',
  name: 'Trộm cắp tài sản',
  description: null,
  order: 1,
  isActive: true,
  parentId: null,
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url === '/directories/types') return Promise.resolve({ data: ['CRIME'] });
    if (url === '/directories') {
      const data = rong ? [] : [MUC];
      return Promise.resolve({ data: { data, total: data.length } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

/** Tham số của lượt gọi CUỐI tới `/directories` (danh sách, không phải `/directories/types`). */
function thamSoCuoi(): Record<string, unknown> {
  const goi = m.get.mock.calls.filter((c) => (c as [string])[0] === '/directories');
  const cuoi = goi[goi.length - 1] as [string, { params?: Record<string, unknown> }] | undefined;
  return cuoi?.[1]?.params ?? {};
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <DirectoriesPage /> }], {
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
 * M6: màn Danh mục tìm ở MÁY CHỦ bằng thẻ — gõ không dấu ra "Trộm cắp", chọn cột (mã, tên, mô tả,
 * trạng thái). Thẻ nằm trên URL `directories_tk`. Trước đây ô chữ gửi `search`, máy chủ so `contains`
 * thường trên mã + tên.
 */
describe('DirectoriesPage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`, về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByText('Trộm cắp tài sản');
    fireEvent.change(o, { target: { value: 'trom' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['*~trom']));
    expect(thamSoCuoi().search).toBeUndefined();
    expect(thamSoCuoi().offset).toBe(0);
    // Lọc loại danh mục vẫn đi kèm.
    expect(thamSoCuoi().type).toBe('CRIME');
  });

  it('thẻ trên URL (`directories_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?directories_tk=trangThai~inactive');
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['trangThai~inactive']));
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?directories_tk=ten~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Tên danh mục' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText('Tìm theo mã hoặc tên...');
    fireEvent.change(o, { target: { value: 'trom' } });
    await waitFor(() => expect(thamSoCuoi().search).toBe('trom'));
    expect(thamSoCuoi().tk).toBeUndefined();
  });
});
