import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AddressMappingModule } from '../AddressMappingModule';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

const ANH_XA = {
  id: 'm1',
  oldWard: 'phường 14',
  oldDistrict: 'quận phú nhuận',
  newWard: 'phường phú nhuận',
  province: 'HCM',
  note: null,
  isActive: true,
  needsReview: false,
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/address-mappings/stats')) {
      return Promise.resolve({ data: { total: 1, needsReview: 0, active: 1 } });
    }
    if (url.startsWith('/address-mappings?')) {
      const data = rong ? [] : [ANH_XA];
      return Promise.resolve({ data: { data, total: data.length } });
    }
    return Promise.resolve({ data: {} });
  });
}

/** Tham số (đã giải mã) của lượt gọi CUỐI tới danh sách `/address-mappings?`. */
function thamSoCuoi(): URLSearchParams {
  const goi = m.get.mock.calls
    .map((c) => (c as [string])[0])
    .filter((u) => u.startsWith('/address-mappings?'));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <AddressMappingModule /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: Ánh xạ địa chỉ (Cài đặt) tìm ở MÁY CHỦ bằng thẻ — gõ "phu nhuan" ra "quận phú nhuận", chọn cột
 * (phường/quận cũ, phường mới, tỉnh, ghi chú, trạng thái). Thẻ trên URL `addressMappings_tk`.
 */
describe('AddressMappingModule — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByText('quận phú nhuận');
    fireEvent.change(o, { target: { value: 'phu nhuan' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['*~phu nhuan']));
    expect(thamSoCuoi().get('search')).toBeNull();
  });

  it('thẻ trên URL (`addressMappings_tk`) → gửi xuống máy chủ khi mở', async () => {
    dung('/?addressMappings_tk=canXemLai~review');
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['canXemLai~review']));
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?addressMappings_tk=quanCu~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Quận/Huyện cũ' })).toBeInTheDocument();
  });

  it('tải hỏng (vd thẻ khoá lạ → 400) → nói chưa hỏi được máy chủ, KHÔNG nói "Không có dữ liệu"', async () => {
    m.get.mockImplementation((url: string) => {
      if (url.startsWith('/address-mappings/stats')) {
        return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
      }
      return Promise.reject({ response: { status: 400, data: { message: 'Khoá thẻ lạ' } } });
    });
    dung();
    const o = await screen.findByTestId('address-mapping-empty');
    await waitFor(() => expect(o.textContent).toContain('Chưa hỏi được máy chủ'));
    expect(o.textContent).not.toContain('Không có dữ liệu');
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText('Tìm phường/xã, quận/huyện...');
    fireEvent.change(o, { target: { value: 'phu' } });
    await waitFor(() => expect(thamSoCuoi().get('search')).toBe('phu'));
    expect(thamSoCuoi().getAll('tk')).toEqual([]);
  });
});
