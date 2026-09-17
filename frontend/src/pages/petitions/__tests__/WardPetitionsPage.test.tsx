/**
 * WardPetitionsPage — Đơn thư theo phường/xã.
 *
 * 17/09/2026 chuyển tìm kiếm, lọc, phân trang và thẻ KPI xuống MÁY CHỦ. Trước đó màn tải `limit=100`
 * trên 47.352 đơn thư rồi lọc tại chỗ: tìm kiếm và 4 thẻ KPI chỉ tính trong 100 đơn mới nhất.
 *
 * Đo prod cùng ngày (chỉ đọc):
 *   - `priority` rỗng 100% → bỏ cột "Mức độ" (nhãn Cao/Trung bình/Thấp là bịa);
 *   - bộ lọc ngày của danh sách lọc `ngayDeXuat` → cột ngày hiện Ngày đề xuất (lệch Ngày nhận ở 29.026 đơn);
 *   - `summary` ≈ `detailContent` (74 đơn khác) → cột Tóm tắt hiện `detailContent`, đúng cột thẻ tìm.
 *
 * Nhóm ca:
 *   F1–F5  : thẻ KPI lấy số từ `/petitions/stats`
 *   F6–F9  : bộ lọc gửi xuống máy chủ (ngày, loại đơn, trạng thái, phường)
 *   F10    : xuất Excel
 *   F11    : nhãn trạng thái có màu
 *   F13    : đặt lại bộ lọc
 *   F14–F15: rỗng / đang tải
 *   F16    : điều hướng dòng
 *   F17    : cột phường
 *   F18    : phân trang máy chủ
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WardPetitionsPage from '../WardPetitionsPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

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

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const DON = [
  { id: 'p1', stt: '2026-1', senderName: 'Người A', petitionType: 'TO_CAO', ngayDeXuat: '2026-02-01T00:00:00.000Z', status: 'MOI_TIEP_NHAN', detailContent: 'Đơn 1', assignedTeam: { ward: { name: 'Phường 2' } } },
  { id: 'p2', stt: '2026-2', senderName: 'Người B', petitionType: 'KHIEU_NAI', ngayDeXuat: '2026-02-05T00:00:00.000Z', status: 'DANG_XU_LY', detailContent: 'Đơn 2', assignedTeam: { ward: { name: 'Phường 4' } } },
  { id: 'p5', stt: '2026-5', senderName: 'Người E', petitionType: 'TO_CAO', ngayDeXuat: '2026-02-20T00:00:00.000Z', status: 'DA_GIAI_QUYET', detailContent: 'Đơn 5', assignedTeam: null },
];

const THONG_KE = {
  total: 3911,
  byStatus: {
    MOI_TIEP_NHAN: 100,
    DANG_XU_LY: 200,
    CHO_PHE_DUYET: 30,
    DA_GIAI_QUYET: 400,
    DA_CHUYEN_VU_VIEC: 50,
    DA_CHUYEN_VU_AN: 7,
  },
  ky: { ky: 'THANG_HIEN_TAI', truong: 'NGAY_TIEP_NHAN', tuNgay: '2026-09-01', denNgay: '2026-09-30' },
};

let rong = false;
let tongDanhSach = 3;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/petitions/stats')) return Promise.resolve({ data: THONG_KE });
    if (url.startsWith('/petitions?')) {
      return Promise.resolve({ data: { data: rong ? [] : DON, total: rong ? 0 : tongDanhSach } });
    }
    return Promise.resolve({ data: [] });
  });
}

const goi = (duong: string) =>
  m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
function thamSoCuoi(duong: '/petitions?' | '/petitions/stats?'): URLSearchParams {
  const g = goi(duong);
  return new URLSearchParams((g[g.length - 1] ?? '').split('?')[1] ?? '');
}
const ds = () => thamSoCuoi('/petitions?');
const tk = () => thamSoCuoi('/petitions/stats?');

function dung(url = '/petitions/ward', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/petitions/ward', element: <WardPetitionsPage /> }], {
    initialEntries: [url],
  });
  // WardFilterDropdown dùng react-query.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const trang = (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

describe('WardPetitionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 3;
    traDuLieu();
  });

  it('F1–F5: 4 thẻ KPI lấy số từ /petitions/stats theo nhóm trạng thái', async () => {
    dung();
    await waitFor(() => expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('3911'));
    expect(screen.getByTestId('kpi-card-pending')).toHaveTextContent('100');
    expect(screen.getByTestId('kpi-card-processing')).toHaveTextContent('230');
    expect(screen.getByTestId('kpi-card-resolved')).toHaveTextContent('457');
  });

  it('nói rõ số liệu tính theo KỲ nào (ô ngày trống thì máy chủ áp kỳ mặc định)', async () => {
    dung();
    expect(await screen.findByTestId('ward-petitions-ky')).toHaveTextContent('Thống kê: Tháng 9/2026');
  });

  it('F6: bảng lọc có ngày, loại đơn, trạng thái', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    expect(screen.queryByTestId('advanced-filter-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    expect(screen.getByTestId('filter-from-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-to-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-petition-type')).toBeInTheDocument();
    expect(screen.getByTestId('filter-status')).toBeInTheDocument();
  });

  it('F7–F9: ngày, loại đơn, trạng thái gửi xuống máy chủ; thống kê theo ngày + loại, bỏ trạng thái', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2026-02-15' } });
    fireEvent.change(screen.getByTestId('filter-petition-type'), { target: { value: 'TO_CAO' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_XU_LY' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_XU_LY'));
    expect(ds().get('fromDate')).toBe('2026-02-15');
    expect(ds().get('petitionType')).toBe('TO_CAO');
    await waitFor(() => expect(tk().get('petitionType')).toBe('TO_CAO'));
    expect(tk().get('fromDate')).toBe('2026-02-15');
    expect(tk().get('status')).toBeNull();
  });

  it('F9b: ngày đang gõ dở (năm ngoài 1900–2100) không gửi', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '0002-02-15' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_XU_LY' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_XU_LY'));
    expect(ds().get('fromDate')).toBeNull();
  });

  it('F10: xuất Excel gọi /petitions/export/ward dạng blob', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    dung();
    await screen.findByTestId('petition-row-p1');
    m.get.mockResolvedValueOnce({ data: new Blob() });
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() =>
      expect(m.get).toHaveBeenCalledWith(
        '/petitions/export/ward',
        expect.objectContaining({ responseType: 'blob' }),
      ),
    );
  });

  it('F11: nhãn trạng thái có màu', async () => {
    dung();
    const xanh = await screen.findByTestId('status-badge-DANG_XU_LY-p2');
    expect(xanh.className).toMatch(/blue/);
    expect(screen.getByTestId('status-badge-DA_GIAI_QUYET-p5').className).toMatch(/green/);
  });

  it('F12: KHÔNG còn cột Mức độ (prod 0% dữ liệu)', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    expect(within(screen.getByTestId('ward-petitions-table')).queryByText('Mức độ')).not.toBeInTheDocument();
  });

  it('F13: đặt lại xoá bộ lọc và tải lại không còn trạng thái', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_XU_LY' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_XU_LY'));
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    await waitFor(() => expect(ds().get('status')).toBeNull());
    expect((screen.getByTestId('filter-status') as HTMLSelectElement).value).toBe('');
  });

  it('F14: rỗng → câu "Không tìm thấy đơn thư"', async () => {
    rong = true;
    dung();
    expect(await screen.findByTestId('ward-petitions-empty')).toHaveTextContent(/Không tìm thấy đơn thư/);
  });

  it('F15: đang tải → "Đang tải"; thẻ KPI hiện dấu gạch, không hiện 0', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    dung();
    expect(await screen.findByTestId('ward-petitions-loading')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('—');
  });

  it('F16: dòng bấm được và có nút xem', async () => {
    dung();
    const dong = await screen.findByTestId('petition-row-p1');
    expect(dong).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('view-btn-p1')).toBeInTheDocument();
  });

  it('F17: cột phường hiện tên phường, rỗng thì gạch', async () => {
    dung();
    await screen.findByTestId('petition-row-p1');
    expect(screen.getByTestId('ward-cell-p1')).toHaveTextContent('Phường 2');
    expect(screen.getByTestId('ward-cell-p5')).toHaveTextContent('—');
  });

  it('F18: phân trang máy chủ — tổng từ máy chủ, trang sau gửi offset', async () => {
    tongDanhSach = 3911;
    dung();
    await screen.findByTestId('petition-row-p1');
    expect(screen.getByTestId('ward-petitions-total')).toHaveTextContent('3911');
    fireEvent.click(screen.getByTestId('ward-petitions-next-page'));
    await waitFor(() => expect(ds().get('offset')).toBe('20'));
    expect(ds().get('limit')).toBe('20');
  });

  it('cột Tóm tắt hiện detailContent; cột ngày hiện Ngày đề xuất', async () => {
    dung();
    const dong = await screen.findByTestId('petition-row-p1');
    expect(within(dong).getByText('Đơn 1')).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-petitions-table')).getByText('Ngày đề xuất')).toBeInTheDocument();
  });
});

describe('WardPetitionsPage — ô tìm kiếm dạng thẻ (máy chủ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 3;
    traDuLieu();
  });

  it('thẻ trên URL gửi xuống máy chủ cho CẢ danh sách lẫn thống kê', async () => {
    dung('/petitions/ward?wardPetitions_tk=nguoiGui~nguoi a');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['nguoiGui~nguoi a']));
    await waitFor(() => expect(tk().getAll('tk')).toEqual(['nguoiGui~nguoi a']));
  });

  it('gõ rồi Enter → thẻ "tất cả các cột", về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('petition-row-p1');
    fireEvent.change(o, { target: { value: 'don 3' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['*~don 3']));
    expect(ds().get('offset')).toBe('0');
  });

  it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/petitions/ward?wardPetitions_tk=nguoiGui~khong ai');
    const vung = await screen.findByTestId('ward-petitions-empty');
    await waitFor(() => expect(vung).toHaveTextContent('Không tìm thấy với'));
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Người gửi' })).toBeInTheDocument();
  });

  it('"Làm mới" xoá cả thẻ', async () => {
    dung('/petitions/ward?wardPetitions_tk=nguoiGui~nguoi a');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
    await waitFor(() => expect(ds().getAll('tk')).toEqual([]));
  });

  it('cờ tắt → ô chữ cũ gửi `search`', async () => {
    dung('/petitions/ward', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'Người B' } });
    await waitFor(() => expect(ds().get('search')).toBe('Người B'));
  });
});
