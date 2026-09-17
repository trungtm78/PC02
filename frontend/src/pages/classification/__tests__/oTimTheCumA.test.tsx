import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import OtherClassificationPage from '../OtherClassificationPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
// Vụ án phường/xã tự chặn quyền: cấp quản trị viên để đi tới đúng danh sách.
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: () => ({ id: 'u1', role: 'ADMIN', username: 'admin' }),
    getToken: () => 't',
  },
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

const VU_VIEC = [
  { id: 'i1', name: 'Trộm cắp xe máy', incidentType: 'Hình sự', unitId: 'Phường 2', status: 'TIEP_NHAN', createdAt: '2026-09-01T02:00:00.000Z' },
  { id: 'i2', name: 'Tranh chấp đất đai', incidentType: 'Dân sự', unitId: 'Phường 6', status: 'TIEP_NHAN', createdAt: '2026-08-01T02:00:00.000Z' },
];
const VU_AN = [
  { id: 'c1', name: 'Trộm cắp tài sản', crime: 'Điều 173', unit: 'Phường 2', status: 'TIEP_NHAN', createdAt: '2026-09-01T02:00:00.000Z' },
  { id: 'c2', name: 'Cố ý gây thương tích', crime: 'Điều 134', unit: 'Phường 6', status: 'TIEP_NHAN', createdAt: '2026-08-01T02:00:00.000Z' },
];

function traDuLieu() {
  m.get.mockImplementation((url: string) =>
    Promise.resolve({ data: { data: url.startsWith('/incidents') ? VU_VIEC : VU_AN } }),
  );
}

interface Man {
  ten: string;
  Man: React.ComponentType;
  prefix: string;
  khoaTen: string;
  nhanTen: string;
  /** Id khớp "trom cap" và id không khớp. */
  khop: string;
  khongKhop: string;
}

const CUM_A: Man[] = [
  { ten: 'Phân loại khác', Man: OtherClassificationPage, prefix: 'otherClassification', khoaTen: 'tenHoSo', nhanTen: 'Tên hồ sơ', khop: 'c1', khongKhop: 'c2' },
];

/**
 * Ô tìm dạng thẻ (M5) cho cụm màn phường/xã và phân loại: tải hết hồ sơ về rồi lọc tại chỗ. Trước đây
 * ô chữ so `toLowerCase().includes` trên vài cột cố định — gõ "trom cap" không ra "Trộm cắp".
 */
for (const { ten, Man, prefix, khoaTen, nhanTen, khop, khongKhop } of CUM_A) {
  describe(`${ten} — ô tìm kiếm dạng thẻ`, () => {
    beforeEach(() => {
      vi.clearAllMocks();
      traDuLieu();
    });

    const dung = (url = '/', flags?: FeatureFlag[]) => {
      const router = createMemoryRouter([{ path: '/', element: <Man /> }], {
        initialEntries: [url],
      });
      const trang = <RouterProvider router={router} />;
      return render(
        flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
      );
    };

    it('thẻ cột tên trên URL lọc không dấu', async () => {
      dung(`/?${prefix}_tk=${khoaTen}~trom cap`);
      expect(await screen.findByTestId(`view-btn-${khop}`)).toBeInTheDocument();
      expect(screen.queryByTestId(`view-btn-${khongKhop}`)).not.toBeInTheDocument();
    });

    it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
      dung();
      const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
      await screen.findByTestId(`view-btn-${khongKhop}`);
      fireEvent.change(o, { target: { value: 'thuong tich dat dai' } });
      fireEvent.change(o, { target: { value: 'trom cap' } });
      fireEvent.keyDown(o, { key: 'Enter' });
      await waitFor(() =>
        expect(screen.queryByTestId(`view-btn-${khongKhop}`)).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId(`view-btn-${khop}`)).toBeInTheDocument();
    });

    it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
      dung(`/?${prefix}_tk=${khoaTen}~khong co ho so nay`);
      const cau = await screen.findByText('Không tìm thấy với:');
      const vung = cau.parentElement as HTMLElement;
      expect(within(vung).getByRole('button', { name: `Bỏ thẻ ${nhanTen}` })).toBeInTheDocument();
    });

    it('cờ tắt → ô chữ cũ', async () => {
      dung(`/?${prefix}_tk=${khoaTen}~trom cap`, CO_TAT_THE);
      expect(await screen.findByTestId('quick-search-input')).toBeInTheDocument();
      expect(await screen.findByTestId(`view-btn-${khongKhop}`)).toBeInTheDocument();
    });
  });
}
