import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PetitionGuidancePage from '../PetitionGuidancePage';
import TransferAndReturnPage from '../TransferAndReturnPage';
import CaseExchangePage from '../CaseExchangePage';
import ActivityLogPage from '../../reports/ActivityLogPage';
import InitialCasesPage from '../../cases/InitialCasesPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
/**
 * Dùng authStore THẬT, chỉ đè hai hàm nhận diện người dùng. Giả lập từng hàm một là đuổi theo
 * bề mặt API đang lớn dần (`getProfile`, `onTokenChanged`, …) và bài kiểm sẽ vỡ mỗi lần store
 * thêm một hàm — hỏng vì lý do không liên quan đến thứ đang đo.
 */
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

/**
 * Cụm B của lớp "tải hỏng nhìn y hệt rỗng" — 5 màn còn lại có số 0 hiện ra khi chặn GET.
 *
 * Đo trên máy thật 29/08/2026:
 *
 *     /initial-cases     9.354 ký tự → 353   không báo lỗi, 5 số 0
 *     /guidance          7.587 ký tự → 367   không báo lỗi, 5 số 0
 *     /activity-log      5.930 ký tự → 303   không báo lỗi, 4 số 0
 *     /transfer-return   3.725 ký tự → 325   không báo lỗi, 4 số 0
 *     /case-exchange     1.585 ký tự → 319   không báo lỗi, 4 số 0
 */
const LOI = {
  isAxiosError: true,
  response: {
    status: 500,
    data: { success: false, error: { code: 'INTERNAL', message: 'Máy chủ bận', details: [] } },
  },
};

const MAN: [string, React.ComponentType, string][] = [
  ['Hồ sơ mới tiếp nhận', InitialCasesPage, 'initial-cases-load-error'],
  ['Hướng dẫn nghiệp vụ', PetitionGuidancePage, 'guidance-load-error'],
  ['Nhật ký hoạt động', ActivityLogPage, 'activity-log-load-error'],
  ['Chuyển đội / Trả hồ sơ', TransferAndReturnPage, 'transfer-load-error'],
  ['Trao đổi chuyên án', CaseExchangePage, 'exchange-load-error'],
];

for (const [ten, Man, testid] of MAN) {
  describe(`${ten} — tải hỏng`, () => {
    beforeEach(() => vi.clearAllMocks());

    const dung = () => {
      const router = createMemoryRouter([{ path: '/', element: <Man /> }]);
      return render(<RouterProvider router={router} />);
    };

    it('hiện khối báo lỗi kèm lý do máy chủ đưa', async () => {
      m.get.mockRejectedValue(LOI);
      dung();
      expect(await screen.findByTestId(testid, {}, { timeout: 5000 })).toHaveTextContent(
        'Máy chủ bận',
      );
    });

    it('tải bình thường thì KHÔNG có khối lỗi', async () => {
      m.get.mockResolvedValue({ data: { data: [] } });
      dung();
      await waitFor(() => expect(m.get).toHaveBeenCalled());
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    });
  });
}
