import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import WardIncidentsPage from '../WardIncidentsPage';
import WardCasesPage from '../WardCasesPage';
import OtherClassificationPage from '../OtherClassificationPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
// Trang vụ án phường/xã tự chặn quyền: không có người dùng thì nó dựng màn "không có quyền"
// thay vì danh sách. Cấp một quản trị viên để đi tới được đúng màn cần đo.
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: () => ({ id: 'u1', role: 'ADMIN', username: 'admin' }),
    getToken: () => 't',
  },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

/**
 * Tải HỎNG phải phân biệt được với KHÔNG CÓ GÌ — cụm màn nặng nhất.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn mọi `GET /api/v1/**` rồi so với lần tải bình thường:
 *
 *     /ward/incidents            133.874 ký tự → 324   không báo lỗi, 5 số 0
 *     /ward/petitions             41.435 ký tự → 392   không báo lỗi, 5 số 0
 *     /classification/duplicates  40.686 ký tự → 321   không báo lỗi, 7 số 0
 *     /ward/cases                 14.255 ký tự → 378   không báo lỗi, 5 số 0
 *     /classification/others      14.093 ký tự → 287   không báo lỗi, 5 số 0
 *
 * Cán bộ nhìn thấy một trang phường/xã sạch bong với vài số 0 — giống hệt màn hình của một đơn
 * vị chưa có hồ sơ nào. Gốc rễ đều là một dòng: `catch { setAllData([]) }`.
 */
const LOI = {
  isAxiosError: true,
  response: {
    status: 500,
    data: { success: false, error: { code: 'INTERNAL', message: 'Máy chủ bận', details: [] } },
  },
};

const MAN: [string, React.ComponentType, string][] = [
  ['Vụ việc phường/xã', WardIncidentsPage, 'ward-incidents-load-error'],
  ['Vụ án phường/xã', WardCasesPage, 'ward-cases-load-error'],
  ['Phân loại khác', OtherClassificationPage, 'others-load-error'],
];

/** Vòng lặp thường thay cho `describe.each`: truyền component qua `each` làm hỏng ngữ cảnh Router. */
for (const [ten, Man, testid] of MAN) {
  describe(`${ten} — tải hỏng`, () => {
    beforeEach(() => vi.clearAllMocks());

    /**
     * Dựng qua `createMemoryRouter` + `RouterProvider` — đúng lối của kho (react-router v7).
     * `<MemoryRouter>` bọc ngoài KHÔNG cấp được ngữ cảnh cho `useNavigate` ở phiên bản này.
     */
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

    /** Chốt then chốt: không con số nào được hiện, vì con số nào cũng sẽ bị đọc là sự thật. */
    it('thẻ thống kê KHÔNG hiện số', async () => {
      m.get.mockRejectedValue(LOI);
      dung();
      await screen.findByTestId(testid, {}, { timeout: 5000 });
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('tải bình thường thì KHÔNG có khối lỗi', async () => {
      m.get.mockResolvedValue({ data: { data: [] } });
      dung();
      await waitFor(() => expect(m.get).toHaveBeenCalled());
      expect(screen.queryByTestId(testid)).not.toBeInTheDocument();
    });
  });
}
