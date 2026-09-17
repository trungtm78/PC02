import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PetitionGuidancePage from '../PetitionGuidancePage';
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

const HUONG_DAN = {
  id: 'g1',
  maHoSo: '2024-482',
  date: '2024-08-07T00:00:00.000Z',
  unit: 'Đội 4',
  guidedPerson: 'Lê Thị Tuyết Hồng',
  guidedPersonPhone: null,
  subject: null,
  guidanceContent: 'Bà Hồng tố cáo đối tượng trên mạng',
  notes: null,
  status: 'PENDING',
  createdBy: { id: 'u1', firstName: 'An', lastName: 'Nguyễn Văn', username: 'annv' },
};

let rong = false;
let tongDanhSach = 1;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/guidance/stats')) {
      return Promise.resolve({
        data: { total: 541, byStatus: { PENDING: 530, COMPLETED: 9, CANCELLED: 2 }, today: 3 },
      });
    }
    if (url.startsWith('/guidance')) {
      const data = rong ? [] : [HUONG_DAN];
      return Promise.resolve({
        data: { success: true, data, total: rong ? 0 : tongDanhSach, page: 1, pageSize: 20 },
      });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

/** Tham số (đã giải mã) của lượt gọi CUỐI tới đường dẫn (danh sách hoặc thống kê). */
function thamSoCuoi(duong: '/guidance?' | '/guidance/stats?'): URLSearchParams {
  const goi = m.get.mock.calls
    .map((c) => (c as [string])[0])
    .filter((u) => u.startsWith(duong));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}
const thamSoDanhSach = () => thamSoCuoi('/guidance?');
const thamSoThongKe = () => thamSoCuoi('/guidance/stats?');

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <PetitionGuidancePage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * Hướng dẫn đơn tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ: prod có 541
 * bản ghi nên 441 bản không bao giờ tìm ra; thẻ thống kê và "Tìm thấy N" đếm trên 100 dòng đã tải; cột
 * STT là mã BỊA `HD-00N/<năm hiện tại>` từ số thứ tự dòng.
 */
describe('PetitionGuidancePage — tìm kiếm và thống kê phía máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 1;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột" cho CẢ danh sách lẫn thống kê, về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('view-guidance-g1');
    fireEvent.change(o, { target: { value: 'lua dao' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['*~lua dao']));
    expect(thamSoDanhSach().get('search')).toBeNull();
    expect(thamSoDanhSach().get('offset')).toBe('0');
    await waitFor(() => expect(thamSoThongKe().getAll('tk')).toEqual(['*~lua dao']));
  });

  it('thẻ trên URL (`guidance_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?guidance_tk=donVi~doi 4');
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['donVi~doi 4']));
  });

  it('khoá lạ trên URL → thẻ đỏ, KHÔNG gửi (không 400 cả danh sách)', async () => {
    dung('/?guidance_tk=khongCo~x');
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(thamSoDanhSach().getAll('tk')).toEqual([]);
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?guidance_tk=vanDe~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Vấn đề' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'hong' } });
    await waitFor(() => expect(thamSoDanhSach().get('search')).toBe('hong'));
    expect(thamSoDanhSach().getAll('tk')).toEqual([]);
  });

  it('thẻ thống kê lấy số từ MÁY CHỦ, không đếm dòng đã tải', async () => {
    dung();
    await screen.findByTestId('view-guidance-g1');
    await waitFor(() => expect(screen.getByTestId('stat-total')).toHaveTextContent('541'));
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('9');
    expect(screen.getByTestId('stat-pending')).toHaveTextContent('530');
    expect(screen.getByTestId('stat-today')).toHaveTextContent('3');
  });

  it('cột STT hiện mã năm-stt thật; không còn mã bịa HD-00N', async () => {
    dung();
    const dong = (await screen.findByTestId('view-guidance-g1')).closest('tr') as HTMLElement;
    expect(within(dong).getByText('2024-482')).toBeInTheDocument();
    expect(screen.queryByText(/HD-\d{3}\//)).not.toBeInTheDocument();
  });

  it('"Tìm thấy N" là tổng của máy chủ; phân trang gửi offset', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-guidance-g1');
    expect(screen.getByTestId('guidance-total')).toHaveTextContent('45');
    fireEvent.click(screen.getByTestId('guidance-next-page'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('20'));
    expect(thamSoDanhSach().get('limit')).toBe('20');
  });

  it('bộ lọc trạng thái + khoảng ngày gửi xuống máy chủ bằng mã enum', async () => {
    dung();
    await screen.findByTestId('view-guidance-g1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'COMPLETED' } });
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2024-08-01' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBe('COMPLETED'));
    expect(thamSoDanhSach().get('fromDate')).toBe('2024-08-01');
    // Thống kê bỏ lọc trạng thái (máy chủ tự bỏ) nhưng vẫn theo khoảng ngày.
    await waitFor(() => expect(thamSoThongKe().get('fromDate')).toBe('2024-08-01'));
  });
  /** Rà mã 17/09: gõ năm từng chữ số, ô ngày bắn 0002-09-17… — gửi đi là 400 và cả màn báo lỗi. */
  it('ngày đang gõ dở (năm ngoài 1900–2100) KHÔNG gửi xuống máy chủ', async () => {
    dung();
    await screen.findByTestId('view-guidance-g1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '0002-09-17' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'PENDING' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBe('PENDING'));
    expect(thamSoDanhSach().get('fromDate')).toBeNull();
  });

  it('đổi bộ lọc rồi đổi NGƯỢC lại → về trang 1, không nhảy lại trang cũ', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-guidance-g1');
    fireEvent.click(screen.getByTestId('guidance-next-page'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('20'));
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'PENDING' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBe('PENDING'));
    expect(thamSoDanhSach().get('offset')).toBe('0');
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: '' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBeNull());
    expect(thamSoDanhSach().get('offset')).toBe('0');
  });

  it('tổng giảm dưới trang đang xem → kẹp về trang cuối còn dữ liệu', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-guidance-g1');
    fireEvent.click(screen.getByTestId('guidance-next-page'));
    fireEvent.click(await screen.findByTestId('guidance-next-page'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('40'));
    tongDanhSach = 25; // người khác xoá bớt: còn 2 trang
    fireEvent.click(screen.getByTestId('refresh-btn'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('20'));
  });
});
