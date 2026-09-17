import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import InitialCasesPage from '../../cases/InitialCasesPage';
import DuplicatePetitionsPage from '../DuplicatePetitionsPage';
import MasterClassPage from '../../admin/MasterClassPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
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
    { id: 'c1aaaaaaaa', caseNumber: 'VA-001', name: 'Trộm cắp tài sản', unit: 'Quận 1', createdAt: NGAY },
    { id: 'c2bbbbbbbb', caseNumber: 'VA-002', name: 'Cố ý gây thương tích', unit: 'Quận 3', createdAt: NGAY },
  ],
  '/petitions': [
    { id: 'p1', stt: 'DT-001', summary: 'Tố cáo trộm cắp', senderName: 'Nguyễn Văn An', status: 'MOI_TIEP_NHAN', receivedDate: NGAY },
    { id: 'p2', stt: 'DT-002', summary: 'Khiếu nại đất đai', senderName: 'Lê Thị Hoa', status: 'MOI_TIEP_NHAN', receivedDate: NGAY },
  ],
  '/proposals': [
    { id: 'k1', proposalNumber: 'KN-001', content: 'Kiến nghị vụ trộm cắp', unit: 'Viện Kiểm sát Quận 1', status: 'CHO_GUI', createdAt: NGAY },
    { id: 'k2', proposalNumber: 'KN-002', content: 'Kiến nghị tranh chấp đất đai', unit: 'Viện Kiểm sát Quận 3', status: 'CHO_GUI', createdAt: NGAY },
  ],
  '/master-classes': [
    { id: 'm1', type: 'LOAI', code: 'TROM', name: 'Trộm cắp', order: 1, isActive: true },
    { id: 'm2', type: 'LOAI', code: 'DAT', name: 'Tranh chấp đất đai', order: 2, isActive: true },
  ],
};

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    const khoa = Object.keys(DU_LIEU).find((k) => url.startsWith(k));
    const data = khoa ? DU_LIEU[khoa] : [];
    return Promise.resolve({ data: { data, total: data.length } });
  });
}

/** Dòng khớp "trom cap" và dòng không khớp: theo testid, hoặc theo chữ khi dòng không có testid. */
type Dong = { testid: string } | { chu: string };

interface Man {
  ten: string;
  Man: React.ComponentType;
  prefix: string;
  khoa: string;
  nhan: string;
  khop: Dong;
  khongKhop: Dong;
  oCu: string;
}

const CUM_C: Man[] = [
  { ten: 'Hồ sơ mới tiếp nhận', Man: InitialCasesPage, prefix: 'initialCases', khoa: 'noiDung', nhan: 'Nội dung vụ việc', khop: { testid: 'initial-row-c1aaaaaaaa' }, khongKhop: { testid: 'initial-row-c2bbbbbbbb' }, oCu: 'initial-search' },
  { ten: 'Đơn trùng', Man: DuplicatePetitionsPage, prefix: 'duplicatePetitions', khoa: 'tieuDe', nhan: 'Tiêu đề', khop: { testid: 'view-btn-p1' }, khongKhop: { testid: 'view-btn-p2' }, oCu: 'quick-search-input' },
  { ten: 'Phân loại danh mục', Man: MasterClassPage, prefix: 'masterClass', khoa: 'ten', nhan: 'Tên', khop: { chu: 'Trộm cắp' }, khongKhop: { chu: 'Tranh chấp đất đai' }, oCu: 'master-class-search' },
];

const tim = (d: Dong) =>
  'testid' in d ? screen.findByTestId(d.testid) : screen.findByText(d.chu);
const coKhong = (d: Dong) =>
  'testid' in d ? screen.queryByTestId(d.testid) : screen.queryByText(d.chu);

/**
 * Ô tìm dạng thẻ (M5) cho bốn màn lọc tại chỗ còn lại. Trước đây ô chữ so
 * `toLowerCase().includes` trên vài cột cố định — gõ "trom cap" không ra "Trộm cắp".
 */
for (const { ten, Man, prefix, khoa, nhan, khop, khongKhop, oCu } of CUM_C) {
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
      expect(await tim(khop)).toBeInTheDocument();
      expect(coKhong(khongKhop)).not.toBeInTheDocument();
    });

    it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
      dung();
      const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
      await tim(khongKhop);
      fireEvent.change(o, { target: { value: 'trom cap' } });
      fireEvent.keyDown(o, { key: 'Enter' });
      await waitFor(() => expect(coKhong(khongKhop)).not.toBeInTheDocument());
      expect(await tim(khop)).toBeInTheDocument();
    });

    it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
      dung(`/?${prefix}_tk=${khoa}~khong co ho so nay`);
      const cau = await screen.findByText('Không tìm thấy với:');
      const vung = cau.parentElement as HTMLElement;
      expect(within(vung).getByRole('button', { name: `Bỏ thẻ ${nhan}` })).toBeInTheDocument();
    });

    it('cờ tắt → ô chữ cũ', async () => {
      dung(`/?${prefix}_tk=${khoa}~trom cap`, CO_TAT_THE);
      expect(await screen.findByTestId(oCu)).toBeInTheDocument();
      expect(await tim(khongKhop)).toBeInTheDocument();
    });
  });
}
