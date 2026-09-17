/**
 * WardCasesPage — Vụ án phường/xã.
 *
 * 17/09/2026 chuyển tìm kiếm, lọc, phân trang, thẻ KPI xuống MÁY CHỦ và bỏ dữ liệu bịa. Trước đó màn:
 *   - tải `limit=100` rồi lọc tại chỗ;
 *   - lọc quyền bằng danh sách phường GÁN CỨNG ("Phường 2/4/6", "Quận 1/3") trên cột `unit` rỗng 100%
 *     → cán bộ không phải quản trị thấy 0 dòng. Phạm vi nay do máy chủ áp (dataScope);
 *   - cột STT là số dòng, Mức độ gán cứng "Trung bình", Bị can luôn rỗng, trạng thái gộp 5 nhóm tự đặt.
 *
 * Đo prod cùng ngày (chỉ đọc, vụ án REGULAR gắn tổ phường: 368): tội danh chính 344, ô chữ `crime` 36;
 * `ngayDeXuat` 368/368.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WardCasesPage from '../WardCasesPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

const CO_TAT_THE: FeatureFlag[] = [
  { key: 'TIM_KIEM_THE', label: 'Tìm kiếm dạng thẻ', description: null, enabled: false, domain: null, rolloutPct: 100 },
];

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), delete: vi.fn() } }));
const vaiTro = { role: 'OFFICER' };
vi.mock('@/stores/auth.store', () => ({
  authStore: { getUser: () => ({ id: 'u1', username: 'canbo', ...vaiTro }), getToken: () => 't' },
}));

const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

const VU_AN = [
  {
    id: 'c1', caseCode: '2026-11171', name: 'Trộm cắp xe máy', crime: null,
    crimeChinh: { id: 'k1', code: 'D173', name: 'Tội trộm cắp tài sản' },
    subjects: [{ id: 's1', fullName: 'Nguyễn Văn A' }, { id: 's2', fullName: 'Trần B' }, { id: 's3', fullName: 'Lê C' }],
    _count: { subjects: 3 },
    ngayDeXuat: '2026-09-01T00:00:00.000Z', status: 'TIEP_NHAN',
    assignedTeam: { id: 't1', name: 'Tổ 2', ward: { name: 'Phường Bến Nghé' } },
  },
  {
    id: 'c2', caseCode: '2026-9', name: 'Cố ý gây thương tích', crime: 'Điều 134',
    crimeChinh: null, subjects: [], _count: { subjects: 0 },
    ngayDeXuat: '2026-08-01T00:00:00.000Z', status: 'DANG_DIEU_TRA', assignedTeam: null,
  },
];

const THONG_KE = {
  total: 368,
  byStatus: { TIEP_NHAN: 329, DANG_DIEU_TRA: 39 },
  byGroup: { 'dang-dieu-tra': 368, 'da-ket-luan': 0, 'dinh-chi': 5, 'tam-dinh-chi': 7 },
};

let rong = false;
let tongDanhSach = 2;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/cases/stats')) return Promise.resolve({ data: THONG_KE });
    if (url.startsWith('/cases?')) {
      return Promise.resolve({ data: { data: rong ? [] : VU_AN, total: rong ? 0 : tongDanhSach } });
    }
    return Promise.resolve({ data: [] });
  });
}

const goi = (duong: string) => m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
function thamSoCuoi(duong: string): URLSearchParams {
  const g = goi(duong);
  return new URLSearchParams((g[g.length - 1] ?? '').split('?')[1] ?? '');
}
const ds = () => thamSoCuoi('/cases?');
const tk = () => thamSoCuoi('/cases/stats?');

function dung(url = '/ward/cases', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/ward/cases', element: <WardCasesPage /> }], { initialEntries: [url] });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const trang = (
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang);
}

describe('WardCasesPage — dữ liệu thật, phạm vi ở máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vaiTro.role = 'OFFICER';
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('cán bộ KHÔNG phải quản trị vẫn thấy vụ án máy chủ trả (không còn lọc phường gán cứng)', async () => {
    dung();
    expect(await screen.findByTestId('ward-case-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('ward-case-row-c2')).toBeInTheDocument();
    expect(screen.queryByText(/Phường 2, Phường 4/)).not.toBeInTheDocument();
  });

  it('gọi /cases (không tải 100 dòng để lọc tại chỗ): limit 20, offset 0', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    expect(ds().get('limit')).toBe('20');
    expect(ds().get('offset')).toBe('0');
    expect(goi('/cases?limit=100')).toEqual([]);
  });

  it('STT là mã hồ sơ dạng ngắn, không phải số dòng', async () => {
    dung();
    const dong = await screen.findByTestId('ward-case-row-c1');
    expect(within(dong).getByText('26-11171')).toBeInTheDocument();
  });

  it('Tội danh hiện tội danh chính (danh mục), lùi ô chữ khi không có', async () => {
    dung();
    expect(within(await screen.findByTestId('ward-case-row-c1')).getByText('Tội trộm cắp tài sản')).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-case-row-c2')).getByText('Điều 134')).toBeInTheDocument();
  });

  it('Bị can hiện tên thật, phần dư +N theo số máy chủ đếm', async () => {
    dung();
    const dong = await screen.findByTestId('ward-case-row-c1');
    expect(within(dong).getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(within(dong).getByText(/\+1/)).toBeInTheDocument();
  });

  it('Phường/Xã là phường của tổ thụ lý; không có thì gạch', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    expect(screen.getByTestId('ward-cell-c1')).toHaveTextContent('Phường Bến Nghé');
    expect(screen.getByTestId('ward-cell-c2')).toHaveTextContent('—');
  });

  it('KHÔNG còn cột Mức độ (gán cứng "Trung bình" cho mọi hồ sơ)', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    const bang = screen.getByTestId('ward-cases-table');
    expect(within(bang).queryByText('Mức độ')).not.toBeInTheDocument();
    expect(within(bang).queryByText('Trung bình')).not.toBeInTheDocument();
  });

  it('trạng thái hiện nhãn enum thật', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    expect(screen.getByTestId('status-badge-TIEP_NHAN-c1')).toHaveTextContent('Tiếp nhận');
  });

  it('thẻ KPI lấy từ /cases/stats (nhóm trạng thái máy chủ), không đếm trên trang đang xem', async () => {
    dung();
    await waitFor(() => expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('368'));
    expect(screen.getByTestId('kpi-card-dang-dieu-tra')).toHaveTextContent('368');
    expect(screen.getByTestId('kpi-card-da-ket-luan')).toHaveTextContent('0');
    expect(screen.getByTestId('kpi-card-dinh-chi')).toHaveTextContent('12');
  });

  it('đang tải → thẻ KPI gạch, không hiện 0', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    dung();
    expect(await screen.findByTestId('ward-cases-loading')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('—');
  });

  it('tải hỏng → báo lỗi, KPI gạch, không nói "không có vụ án"', async () => {
    m.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { success: false, error: { code: 'X', message: 'Máy chủ bận', details: [] } } },
    });
    dung();
    expect(await screen.findByTestId('ward-cases-load-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('kpi-card-total')).toHaveTextContent('—');
    expect(screen.getByTestId('ward-cases-empty')).not.toHaveTextContent('Không tìm thấy vụ án');
  });

  it('ngày, trạng thái gửi máy chủ; thống kê theo ngày nhưng bỏ trạng thái', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_DIEU_TRA' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_DIEU_TRA'));
    expect(ds().get('fromDate')).toBe('2026-09-01');
    await waitFor(() => expect(tk().get('fromDate')).toBe('2026-09-01'));
    expect(tk().get('status')).toBeNull();
  });

  it('ngày đang gõ dở không gửi', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '0002-09-01' } });
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'DANG_DIEU_TRA' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_DIEU_TRA'));
    expect(ds().get('fromDate')).toBeNull();
  });

  it('phân trang máy chủ: tổng từ máy chủ, trang sau gửi offset 20', async () => {
    tongDanhSach = 368;
    dung();
    await screen.findByTestId('ward-case-row-c1');
    expect(screen.getByTestId('ward-cases-total')).toHaveTextContent('368');
    fireEvent.click(screen.getByTestId('ward-cases-next-page'));
    await waitFor(() => expect(ds().get('offset')).toBe('20'));
  });

  it('xuất Excel gửi CÙNG bộ lọc danh sách (thẻ, trạng thái)', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    dung('/ward/cases?wardCases_tk=tenVuAn~trom');
    await screen.findByTestId('ward-case-row-c1');
    fireEvent.click(screen.getByTestId('filter-toggle-btn'));
    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'TIEP_NHAN' } });
    await waitFor(() => expect(ds().get('status')).toBe('TIEP_NHAN'));
    m.get.mockResolvedValueOnce({ data: new Blob() });
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() => expect(goi('/cases/export/ward?').length).toBe(1));
    const q = thamSoCuoi('/cases/export/ward?');
    expect(q.getAll('tk')).toEqual(['tenVuAn~trom']);
    expect(q.get('status')).toBe('TIEP_NHAN');
    expect(m.get.mock.calls.find((c) => String(c[0]).startsWith('/cases/export/ward?'))?.[1]).toEqual(
      expect.objectContaining({ responseType: 'blob' }),
    );
  });

  it('nút xoá chỉ hiện với quản trị viên', async () => {
    dung();
    await screen.findByTestId('ward-case-row-c1');
    expect(screen.queryByTestId('delete-btn-c1')).not.toBeInTheDocument();
  });

  it('quản trị viên xoá → gọi DELETE rồi tải lại', async () => {
    vaiTro.role = 'ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    m.delete.mockResolvedValue({ data: {} });
    dung();
    await screen.findByTestId('ward-case-row-c1');
    const truoc = goi('/cases?').length;
    fireEvent.click(screen.getByTestId('delete-btn-c1'));
    await waitFor(() => expect(m.delete).toHaveBeenCalledWith('/cases/c1'));
    await waitFor(() => expect(goi('/cases?').length).toBeGreaterThan(truoc));
  });
});

describe('WardCasesPage — ô tìm kiếm dạng thẻ (máy chủ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vaiTro.role = 'OFFICER';
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('thẻ trên URL gửi xuống máy chủ cho CẢ danh sách lẫn thống kê', async () => {
    dung('/ward/cases?wardCases_tk=toiDanhChinh~trom cap');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['toiDanhChinh~trom cap']));
    await waitFor(() => expect(tk().getAll('tk')).toEqual(['toiDanhChinh~trom cap']));
  });

  it('thẻ STT gõ "78" gửi nguyên chuỗi — máy chủ khớp chứa', async () => {
    dung('/ward/cases?wardCases_tk=stt~78');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['stt~78']));
  });

  it('gõ rồi Enter → thẻ "tất cả các cột", về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('ward-case-row-c1');
    fireEvent.change(o, { target: { value: 'trom' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['*~trom']));
    expect(ds().get('offset')).toBe('0');
  });

  it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/ward/cases?wardCases_tk=tenVuAn~khong co');
    const vung = await screen.findByTestId('ward-cases-empty');
    await waitFor(() => expect(vung).toHaveTextContent('Không tìm thấy với'));
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Tên vụ án' })).toBeInTheDocument();
  });

  it('"Làm mới" xoá cả thẻ', async () => {
    dung('/ward/cases?wardCases_tk=tenVuAn~trom');
    expect(await screen.findByTestId('the-tim-kiem')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    await waitFor(() => expect(screen.queryByTestId('the-tim-kiem')).not.toBeInTheDocument());
    await waitFor(() => expect(ds().getAll('tk')).toEqual([]));
  });

  it('cờ tắt → ô chữ cũ gửi `search`', async () => {
    dung('/ward/cases', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'trộm' } });
    await waitFor(() => expect(ds().get('search')).toBe('trộm'));
  });
});
