import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import TransferAndReturnPage from '../TransferAndReturnPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
/** authStore THẬT, chỉ đè hàm nhận diện người dùng — như taiHongKhacRongCumB. */
vi.mock('@/stores/auth.store', async (goc) => {
  const that = (await goc()) as Record<string, unknown>;
  const NGUOI = { id: 'u1', role: 'ADMIN', username: 'admin', teams: [] };
  return {
    ...that,
    authStore: {
      ...(that.authStore as object),
      getUser: () => NGUOI,
      getProfile: () => NGUOI,
      getToken: () => 't',
      isAuthenticated: () => true,
    },
  };
});

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

const NGAY = '2026-09-01T02:00:00.000Z';

const DU_LIEU: Record<string, unknown[]> = {
  '/cases': [
    { id: 'c1aaaaaaaa', name: 'Trộm cắp tài sản', unit: 'Đội 1', status: 'TIEP_NHAN', createdAt: NGAY },
    { id: 'c2bbbbbbbb', name: 'Cố ý gây thương tích', unit: 'Đội 2', status: 'TIEP_NHAN', createdAt: NGAY },
  ],
};

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    const khoa = Object.keys(DU_LIEU).find((k) => url.startsWith(k));
    return Promise.resolve({ data: { data: khoa ? DU_LIEU[khoa] : [] } });
  });
}

interface Man {
  ten: string;
  Man: React.ComponentType;
  prefix: string;
  khoa: string;
  nhan: string;
  /** Testid nút xem của dòng khớp "trom cap" và dòng không khớp. */
  khop: string;
  khongKhop: string;
}

const CUM_B: Man[] = [
  { ten: 'Chuyển đội / Trả hồ sơ', Man: TransferAndReturnPage, prefix: 'transferReturn', khoa: 'tenHoSo', nhan: 'Tên hồ sơ', khop: 'view-record-c1aaaaaaaa', khongKhop: 'view-record-c2bbbbbbbb' },
];

/**
 * Ô tìm dạng thẻ (M5) cho cụm màn nghiệp vụ: tải danh sách về rồi lọc tại chỗ. Trước đây ô chữ so
 * `toLowerCase().includes` trên vài cột cố định — gõ "trom cap" không ra "Trộm cắp".
 */
for (const { ten, Man, prefix, khoa, nhan, khop, khongKhop } of CUM_B) {
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

    it('thẻ cột trên URL lọc không dấu', async () => {
      dung(`/?${prefix}_tk=${khoa}~trom cap`);
      expect(await screen.findByTestId(khop)).toBeInTheDocument();
      expect(screen.queryByTestId(khongKhop)).not.toBeInTheDocument();
    });

    it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
      dung();
      const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
      await screen.findByTestId(khongKhop);
      fireEvent.change(o, { target: { value: 'trom cap' } });
      fireEvent.keyDown(o, { key: 'Enter' });
      await waitFor(() => expect(screen.queryByTestId(khongKhop)).not.toBeInTheDocument());
      expect(screen.getByTestId(khop)).toBeInTheDocument();
    });

    it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
      dung(`/?${prefix}_tk=${khoa}~khong co ho so nay`);
      const cau = await screen.findByText('Không tìm thấy với:');
      const vung = cau.parentElement as HTMLElement;
      expect(within(vung).getByRole('button', { name: `Bỏ thẻ ${nhan}` })).toBeInTheDocument();
    });

    it('cờ tắt → ô chữ cũ', async () => {
      dung(`/?${prefix}_tk=${khoa}~trom cap`, CO_TAT_THE);
      expect(await screen.findByTestId('quick-search-input')).toBeInTheDocument();
      expect(await screen.findByTestId(khongKhop)).toBeInTheDocument();
    });
  });
}
