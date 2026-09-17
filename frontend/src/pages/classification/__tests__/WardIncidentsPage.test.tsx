/**
 * WardIncidentsPage — Vụ việc phường/xã.
 *
 * 17/09/2026 chuyển tìm kiếm, lọc, phân trang, thẻ KPI xuống MÁY CHỦ và bỏ dữ liệu bịa. Trước đó màn tải
 * `limit=100` trên 4.725 vụ việc rồi lọc tại chỗ; STT là số dòng; Phường đọc `unitId` (prod 0%); Loại đọc
 * `incidentType` (0%); Địa điểm hiện mô tả; Mức độ gán cứng "Trung bình"; trạng thái gộp 4 nhóm tự đặt.
 *
 * Đo prod cùng ngày (chỉ đọc, 1.165 vụ việc tổ phường): tội danh chính 1.009, `benVu` 1.112, `code` và
 * `ngayDeXuat` 100%, địa chỉ xảy ra 6.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WardIncidentsPage from '../WardIncidentsPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

const CO_TAT_THE: FeatureFlag[] = [
  { key: 'TIM_KIEM_THE', label: 'Tìm kiếm dạng thẻ', description: null, enabled: false, domain: null, rolloutPct: 100 },
];

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const VU_VIEC = [
  {
    id: 'i1', code: '2026-9706', name: 'Mất trộm xe máy tại nhà',
    crimeChinh: { name: 'Tội trộm cắp tài sản' }, benVu: 'Nguyễn Văn Bị Hại',
    incidentType: null, unitId: null, description: 'Mô tả dài',
    ngayDeXuat: '2026-09-02T00:00:00.000Z', status: 'TIEP_NHAN',
    assignedTeam: { id: 't1', name: 'Tổ 3', ward: { name: 'Phường Sài Gòn' } },
  },
  {
    id: 'i2', code: '2026-12', name: 'Đánh nhau', crimeChinh: null, benVu: null,
    ngayDeXuat: '2026-08-01T00:00:00.000Z', status: 'DA_CHUYEN_VU_AN', assignedTeam: null,
  },
];

const THONG_KE = {
  total: 1165,
  byStatus: { TIEP_NHAN: 1162, DA_CHUYEN_VU_AN: 3 },
  byGroup: { 'tiep-nhan': 1162, 'xac-minh': 0, 'ket-qua': 3, 'tam-dinh-chi': 0 },
  ky: { ky: 'THANG_HIEN_TAI', truong: 'NGAY_TIEP_NHAN', tuNgay: '2026-09-01', denNgay: '2026-09-30' },
};

let rong = false;
let tongDanhSach = 2;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/incidents/stats')) return Promise.resolve({ data: THONG_KE });
    if (url.startsWith('/incidents?')) {
      return Promise.resolve({ data: { data: rong ? [] : VU_VIEC, total: rong ? 0 : tongDanhSach } });
    }
    return Promise.resolve({ data: [] });
  });
}

const goi = (duong: string) => m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
function thamSoCuoi(duong: string): URLSearchParams {
  const g = goi(duong);
  return new URLSearchParams((g[g.length - 1] ?? '').split('?')[1] ?? '');
}
const ds = () => thamSoCuoi('/incidents?');
const tk = () => thamSoCuoi('/incidents/stats?');

function dung(url = '/ward/incidents', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/ward/incidents', element: <WardIncidentsPage /> }], {
    initialEntries: [url],
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const trang = (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang);
}

describe('WardIncidentsPage — dữ liệu thật, lọc ở máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('gọi /incidents phân trang máy chủ (không tải 100 dòng để lọc tại chỗ)', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    expect(ds().get('limit')).toBe('20');
    expect(ds().get('offset')).toBe('0');
    expect(goi('/incidents?limit=100')).toEqual([]);
    // Codex P2: cột ngày CỐ ĐỊNH là Ngày đề xuất (đúng cột đang hiện) — admin đặt kỳ "theo Ngày tạo" thì máy
    // chủ lọc `createdAt` (ngày di trú) nếu màn không nói rõ.
    expect(ds().get('thongKeTruongNgay')).toBe('NGAY_TIEP_NHAN');
    expect(tk().get('thongKeTruongNgay')).toBe('NGAY_TIEP_NHAN');
  });

  it('STT là mã hồ sơ dạng ngắn, không phải số dòng', async () => {
    dung();
    expect(within(await screen.findByTestId('ward-incident-row-i1')).getByText('26-9706')).toBeInTheDocument();
  });

  it('Tội danh = tội danh chính; Người cung cấp, bị hại = benVu; trống thì gạch', async () => {
    dung();
    const dong = await screen.findByTestId('ward-incident-row-i1');
    expect(within(dong).getByText('Tội trộm cắp tài sản')).toBeInTheDocument();
    expect(within(dong).getByText('Nguyễn Văn Bị Hại')).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-incident-row-i2')).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('Phường/Xã là phường của tổ thụ lý (không đọc unitId)', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    expect(screen.getByTestId('ward-cell-i1')).toHaveTextContent('Phường Sài Gòn');
    expect(screen.getByTestId('ward-cell-i2')).toHaveTextContent('—');
  });

  it('KHÔNG còn cột Loại, Địa điểm, Mức độ (prod 0% / hiện mô tả / gán cứng)', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    const bang = screen.getByTestId('ward-incidents-table');
    for (const tieuDe of ['Loại', 'Địa điểm', 'Mức độ', 'Trung bình']) {
      expect(within(bang).queryByText(tieuDe)).not.toBeInTheDocument();
    }
    expect(within(bang).queryByText('Mô tả dài')).not.toBeInTheDocument();
  });

  it('trạng thái hiện nhãn enum thật', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    expect(screen.getByTestId('status-badge-TIEP_NHAN-i1')).toHaveTextContent('Tiếp nhận');
  });

  it('thẻ KPI theo 4 giai đoạn máy chủ đếm + tổng', async () => {
    dung();
    await waitFor(() => expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('1165'));
    expect(screen.getByTestId('kpi-card-tiep-nhan')).toHaveTextContent('1162');
    expect(screen.getByTestId('kpi-card-xac-minh')).toHaveTextContent('0');
    expect(screen.getByTestId('kpi-card-ket-qua')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-card-tam-dinh-chi')).toHaveTextContent('0');
  });

  it('nói rõ số liệu tính theo KỲ nào', async () => {
    dung();
    expect(await screen.findByTestId('ward-incidents-ky')).toHaveTextContent('Thống kê: Tháng 9/2026');
  });

  it('[rà mã P3] chọn ngày → nhãn ghi đúng khoảng đang áp, không giữ kỳ mặc định', async () => {
    dung();
    await screen.findByTestId('ward-incidents-ky');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-to-date'), { target: { value: '2025-12-31' } });
    await waitFor(() =>
      expect(screen.getByTestId('ward-incidents-ky')).toHaveTextContent('Thống kê: 01/09/2026 – 31/12/2025'),
    );
  });

  it('[rà mã P3] chưa chọn phường → chỉ hồ sơ tổ CÓ phường (chiToPhuong), cả danh sách lẫn thống kê', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    expect(ds().get('chiToPhuong')).toBe('true');
    expect(tk().get('chiToPhuong')).toBe('true');
  });

  it('đang tải → KPI gạch; tải hỏng → báo lỗi, không nói "không có"', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    const { unmount } = dung();
    expect(await screen.findByTestId('ward-incidents-loading')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('—');
    unmount();
    m.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { success: false, error: { code: 'X', message: 'Máy chủ bận', details: [] } } },
    });
    dung();
    expect(await screen.findByTestId('ward-incidents-load-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('ward-incidents-empty')).not.toHaveTextContent('Không tìm thấy vụ việc');
  });

  it('ngày (fromDateRange/toDateRange) và trạng thái gửi máy chủ; thống kê bỏ trạng thái', async () => {
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('filter-to-date'), { target: { value: '0002-09-01' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'TIEP_NHAN' } });
    await waitFor(() => expect(ds().get('status')).toBe('TIEP_NHAN'));
    expect(ds().get('fromDateRange')).toBe('2026-09-01');
    expect(ds().get('toDateRange')).toBeNull();
    await waitFor(() => expect(tk().get('fromDateRange')).toBe('2026-09-01'));
    expect(tk().get('status')).toBeNull();
  });

  it('phân trang máy chủ: trang sau gửi offset 20', async () => {
    tongDanhSach = 1165;
    dung();
    await screen.findByTestId('ward-incident-row-i1');
    expect(screen.getByTestId('ward-incidents-total')).toHaveTextContent('1165');
    fireEvent.click(screen.getByTestId('ward-incidents-next-page'));
    await waitFor(() => expect(ds().get('offset')).toBe('20'));
  });

  it('xuất Excel gửi CÙNG bộ lọc danh sách', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    dung('/ward/incidents?wardIncidents_tk=tenVuViec~trom');
    await screen.findByTestId('ward-incident-row-i1');
    m.get.mockResolvedValueOnce({ data: new Blob() });
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() => expect(goi('/incidents/export/ward?').length).toBe(1));
    expect(thamSoCuoi('/incidents/export/ward?').getAll('tk')).toEqual(['tenVuViec~trom']);
  });
});

describe('WardIncidentsPage — ô tìm kiếm dạng thẻ (máy chủ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('thẻ trên URL gửi xuống CẢ danh sách lẫn thống kê', async () => {
    dung('/ward/incidents?wardIncidents_tk=toiDanhChinh~trom cap');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['toiDanhChinh~trom cap']));
    await waitFor(() => expect(tk().getAll('tk')).toEqual(['toiDanhChinh~trom cap']));
  });

  it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('ward-incident-row-i1');
    fireEvent.change(o, { target: { value: 'trom' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['*~trom']));
  });

  it('không có kết quả với thẻ → nói rõ thẻ nào', async () => {
    rong = true;
    dung('/ward/incidents?wardIncidents_tk=tenVuViec~khong co');
    const vung = await screen.findByTestId('ward-incidents-empty');
    await waitFor(() => expect(vung).toHaveTextContent('Không tìm thấy với'));
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Tên vụ việc' })).toBeInTheDocument();
  });

  it('"Làm mới" xoá cả thẻ', async () => {
    dung('/ward/incidents?wardIncidents_tk=tenVuViec~trom');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
  });

  it('cờ tắt → ô chữ cũ gửi `search`', async () => {
    dung('/ward/incidents', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'trộm' } });
    await waitFor(() => expect(ds().get('search')).toBe('trộm'));
  });
});
