import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import InvestigationDelegationPage from '../InvestigationDelegationPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/csv', () => ({ downloadCsv: vi.fn() }));

import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
const m = vi.mocked(api) as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

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

const UY_THAC = {
  id: 'd1',
  delegationNumber: 'UT-001/2026',
  delegationDate: '2026-09-01T00:00:00.000Z',
  receivingUnit: 'Công an phường Tân Định',
  status: 'PENDING',
  content: 'Xác minh nhân thân đối tượng',
  createdBy: { firstName: 'An', lastName: 'Nguyễn Văn' },
  relatedCase: { name: 'Trộm cắp tài sản' },
};

let rong = false;
let tongDanhSach = 1;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/delegations/stats')) {
      return Promise.resolve({
        data: { total: 12, byStatus: { PENDING: 7, RECEIVED: 3, COMPLETED: 2 } },
      });
    }
    if (url.startsWith('/delegations')) {
      const data = rong ? [] : [UY_THAC];
      return Promise.resolve({
        data: { success: true, data, total: rong ? 0 : tongDanhSach, page: 1, pageSize: 20 },
      });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

function goiToi(duong: string): string[] {
  return m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
}
function thamSoCuoi(duong: '/delegations?' | '/delegations/stats?'): URLSearchParams {
  const goi = goiToi(duong);
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}
const thamSoDanhSach = () => thamSoCuoi('/delegations?');
const thamSoThongKe = () => thamSoCuoi('/delegations/stats?');

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <InvestigationDelegationPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * Ủy thác điều tra tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ; thẻ thống kê
 * đếm trên phần đã tải; ô chọn "Đơn vị nhận" liệt kê cứng 5 công an quận; lọc ngày so chuỗi tại chỗ.
 */
describe('InvestigationDelegationPage — tìm kiếm và thống kê phía máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 1;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột" cho CẢ danh sách lẫn thống kê, về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('view-delegation-d1');
    fireEvent.change(o, { target: { value: 'tan dinh' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['*~tan dinh']));
    expect(thamSoDanhSach().get('offset')).toBe('0');
    await waitFor(() => expect(thamSoThongKe().getAll('tk')).toEqual(['*~tan dinh']));
  });

  it('thẻ trên URL (`delegation_tk`) → gửi xuống máy chủ; khoá lạ không gửi', async () => {
    dung('/?delegation_tk=donViNhan~tan dinh');
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['donViNhan~tan dinh']));
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?delegation_tk=noiDung~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Nội dung' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'tan dinh' } });
    await waitFor(() => expect(thamSoDanhSach().get('search')).toBe('tan dinh'));
    expect(thamSoDanhSach().getAll('tk')).toEqual([]);
  });

  it('thẻ thống kê lấy số từ MÁY CHỦ, không đếm dòng đã tải', async () => {
    dung();
    await screen.findByTestId('view-delegation-d1');
    await waitFor(() => expect(screen.getByTestId('stat-total')).toHaveTextContent('12'));
    expect(screen.getByTestId('stat-pending')).toHaveTextContent('7');
    expect(screen.getByTestId('stat-received')).toHaveTextContent('3');
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('2');
  });

  it('đang tải lần đầu → thẻ thống kê hiện "—"', async () => {
    m.get.mockImplementation(() => new Promise(() => undefined));
    dung();
    expect(await screen.findByTestId('stat-total')).toHaveTextContent('—');
  });

  it('"Tìm thấy N" là tổng máy chủ; phân trang gửi offset', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-delegation-d1');
    expect(screen.getByTestId('delegation-total')).toHaveTextContent('45');
    fireEvent.click(screen.getByTestId('delegation-next-page'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('20'));
  });

  it('bộ lọc trạng thái (mã enum) + ngày gửi máy chủ; ngày gõ dở không gửi; không còn ô chọn đơn vị bịa', async () => {
    dung();
    await screen.findByTestId('view-delegation-d1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    expect(screen.queryByText('Công an Quận Tân Bình')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'RECEIVED' } });
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '0002-09-01' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBe('RECEIVED'));
    expect(thamSoDanhSach().get('fromDate')).toBeNull();
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2026-09-01' } });
    await waitFor(() => expect(thamSoDanhSach().get('fromDate')).toBe('2026-09-01'));
    await waitFor(() => expect(thamSoThongKe().get('fromDate')).toBe('2026-09-01'));
    expect(thamSoThongKe().get('status')).toBeNull();
  });

  /** Xuất CSV phải gồm MỌI dòng khớp bộ lọc, không chỉ trang đang xem. */
  it('xuất Excel tải đủ mọi trang khớp bộ lọc rồi mới ghi tệp', async () => {
    tongDanhSach = 25;
    dung('/?delegation_tk=donViNhan~tan dinh');
    await screen.findByTestId('view-delegation-d1');
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalled());
    const xuat = goiToi('/delegations?').filter((u) => new URLSearchParams(u.split('?')[1]).get('limit') === '200');
    expect(xuat.length).toBeGreaterThan(0);
    expect(new URLSearchParams(xuat[0].split('?')[1]).getAll('tk')).toEqual(['donViNhan~tan dinh']);
  });

  /** Danh sách đã phân trang → kiểm trùng tại chỗ chỉ thấy một trang; máy chủ trả 409 thì phải NÓI ra. */
  it('lưu trùng số ủy thác (máy chủ 409) → báo lỗi dưới ô Số ủy thác, không im lặng', async () => {
    m.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { success: false, error: { code: 'DUPLICATE_VALUE', message: 'Trùng', details: [] } } },
    });
    dung();
    await screen.findByTestId('view-delegation-d1');
    fireEvent.click(screen.getByTestId('create-delegation-btn'));
    fireEvent.change(await screen.findByTestId('delegation-number-input'), {
      target: { value: 'UT-009/2026' },
    });
    fireEvent.change(screen.getByTestId('delegation-content-textarea'), {
      target: { value: 'Nội dung ủy thác đủ dài' },
    });
    fireEvent.change(screen.getByTestId('receiving-unit-select'), {
      target: { value: 'Công an Quận 1' },
    });
    fireEvent.click(screen.getByTestId('save-delegation-btn'));
    expect(await screen.findByText(/UT-009\/2026.*đã tồn tại/)).toBeInTheDocument();
  });
});
