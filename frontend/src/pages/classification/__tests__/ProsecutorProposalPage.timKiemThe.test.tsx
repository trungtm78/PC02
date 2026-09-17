import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ProsecutorProposalPage from '../ProsecutorProposalPage';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
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

const KIEN_NGHI = {
  id: 'k1',
  proposalNumber: 'DX-2026-00007',
  relatedCase: { name: 'Lừa đảo chiếm đoạt tài sản' },
  content: 'Kiến nghị khắc phục vi phạm',
  createdAt: '2026-09-01T02:00:00.000Z',
  unit: 'Tổ hình sự khu vực Quận 8',
  status: 'CHO_GUI',
};

let rong = false;
let tongDanhSach = 1;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/proposals/stats')) {
      return Promise.resolve({
        data: { total: 33, byStatus: { CHO_GUI: 30, DA_GUI: 2, CO_PHAN_HOI: 1, DA_XU_LY: 0 } },
      });
    }
    if (url.startsWith('/proposals')) {
      const data = rong ? [] : [KIEN_NGHI];
      return Promise.resolve({
        data: { success: true, data, total: rong ? 0 : tongDanhSach, page: 1, pageSize: 20 },
      });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

function thamSoCuoi(duong: '/proposals?' | '/proposals/stats?'): URLSearchParams {
  const goi = m.get.mock.calls
    .map((c) => (c as [string])[0])
    .filter((u) => u.startsWith(duong));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}
const thamSoDanhSach = () => thamSoCuoi('/proposals?');
const thamSoThongKe = () => thamSoCuoi('/proposals/stats?');

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <ProsecutorProposalPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * Kiến nghị VKS tìm ở MÁY CHỦ (17/09/2026). Trước đó màn tải `limit=100` rồi lọc tại chỗ, thẻ thống kê
 * đếm trên phần đã tải, và ô chọn "Đơn vị VKS" liệt kê cứng bốn VKS quận không có trong dữ liệu.
 */
describe('ProsecutorProposalPage — tìm kiếm và thống kê phía máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 1;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột" cho CẢ danh sách lẫn thống kê, về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('view-btn-k1');
    fireEvent.change(o, { target: { value: 'lua dao' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['*~lua dao']));
    expect(thamSoDanhSach().get('offset')).toBe('0');
    await waitFor(() => expect(thamSoThongKe().getAll('tk')).toEqual(['*~lua dao']));
  });

  it('thẻ trên URL (`prosecutorProposal_tk`) → gửi xuống máy chủ', async () => {
    dung('/?prosecutorProposal_tk=donViVks~quan 8');
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual(['donViVks~quan 8']));
  });

  it('khoá lạ trên URL → thẻ đỏ, KHÔNG gửi', async () => {
    dung('/?prosecutorProposal_tk=khongCo~x');
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(thamSoDanhSach().getAll('tk')).toEqual([]);
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?prosecutorProposal_tk=noiDung~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(
      within(vung).getByRole('button', { name: 'Bỏ thẻ Nội dung kiến nghị' }),
    ).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'quan 8' } });
    await waitFor(() => expect(thamSoDanhSach().get('search')).toBe('quan 8'));
    expect(thamSoDanhSach().getAll('tk')).toEqual([]);
  });

  it('thẻ thống kê lấy số từ MÁY CHỦ, không đếm dòng đã tải', async () => {
    dung();
    await screen.findByTestId('view-btn-k1');
    const the = () => screen.getAllByTestId('proposal-stat');
    await waitFor(() => expect(the()[0]).toHaveTextContent('33'));
    expect(the()[1]).toHaveTextContent('30');
    expect(the()[2]).toHaveTextContent('2');
    expect(the()[3]).toHaveTextContent('1');
    expect(the()[4]).toHaveTextContent('0');
  });

  it('"Hiển thị N" là tổng của máy chủ; phân trang gửi offset; STT theo trang', async () => {
    tongDanhSach = 45;
    dung();
    await screen.findByTestId('view-btn-k1');
    expect(screen.getByTestId('proposal-total')).toHaveTextContent('45');
    fireEvent.click(screen.getByTestId('proposal-next-page'));
    await waitFor(() => expect(thamSoDanhSach().get('offset')).toBe('20'));
    const dong = (await screen.findByTestId('view-btn-k1')).closest('tr') as HTMLElement;
    expect(within(dong).getByText('21')).toBeInTheDocument();
  });

  it('bộ lọc trạng thái (mã enum) + khoảng ngày gửi xuống máy chủ; ngày gõ dở không gửi', async () => {
    dung();
    await screen.findByTestId('view-btn-k1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DA_GUI' } });
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '0002-09-01' } });
    await waitFor(() => expect(thamSoDanhSach().get('status')).toBe('DA_GUI'));
    expect(thamSoDanhSach().get('fromDate')).toBeNull();
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2025-08-01' } });
    await waitFor(() => expect(thamSoDanhSach().get('fromDate')).toBe('2025-08-01'));
    await waitFor(() => expect(thamSoThongKe().get('fromDate')).toBe('2025-08-01'));
    expect(thamSoThongKe().get('status')).toBeNull();
  });

  it('không còn ô chọn Đơn vị VKS liệt kê cứng', async () => {
    dung();
    await screen.findByTestId('view-btn-k1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    expect(screen.queryByText('Viện Kiểm sát Quận 1')).not.toBeInTheDocument();
  });

  it('xuất Excel gửi CÙNG thẻ và bộ lọc với danh sách', async () => {
    dung('/?prosecutorProposal_tk=donViVks~quan 8');
    await screen.findByTestId('view-btn-k1');
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() =>
      expect(m.get.mock.calls.some((c) => String(c[0]).startsWith('/proposals/export?'))).toBe(
        true,
      ),
    );
    const url = String(m.get.mock.calls.find((c) => String(c[0]).startsWith('/proposals/export?'))![0]);
    expect(new URLSearchParams(url.split('?')[1]).getAll('tk')).toEqual(['donViVks~quan 8']);
  });

  /** Rà mã 226abee2: chưa có số từ máy chủ mà hiện "0" là một khẳng định sai — phải hiện dấu gạch. */
  it('đang tải lần đầu → thẻ thống kê hiện "—", không hiện "0"', async () => {
    m.get.mockImplementation(() => new Promise(() => undefined));
    dung();
    const the = await screen.findAllByTestId('proposal-stat');
    for (const t of the) expect(t).toHaveTextContent('—');
  });

  it('nút xoá lọc xoá thẻ và tải lại không còn `tk`', async () => {
    dung('/?prosecutorProposal_tk=donViVks~quan 8');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
    await waitFor(() => expect(thamSoDanhSach().getAll('tk')).toEqual([]));
  });
});
