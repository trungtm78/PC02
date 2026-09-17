/**
 * InitialCasesPage — Hồ sơ mới tiếp nhận (vụ án ở trạng thái Tiếp nhận, chờ nhận xử lý).
 *
 * 17/09/2026 chuyển tìm kiếm, lọc, phân trang và thẻ số xuống MÁY CHỦ và bỏ dữ liệu bịa. Trước đó màn tải
 * 50/860 hồ sơ rồi lọc tại chỗ; Số hồ sơ đọc `caseNumber` (không tồn tại → id cắt 8 ký tự); Loại đọc
 * `caseProvenance` mà API không trả; Mức độ đọc `priority` (Vụ án không có trường này → luôn "Bình
 * thường"); Hạn xử lý/Quá hạn đọc `deadline` (prod 0/860); Đơn vị đọc `unit` (rỗng) với ô lọc quận gán cứng.
 *
 * Đo prod cùng ngày (chỉ đọc, 860 vụ án Tiếp nhận): Đơn vị giải quyết 814, Tóm tắt 813, Nguồn đơn 541,
 * Ngày đề xuất 840; nguồn hồ sơ Chuyển đến 856, Từ đơn thư 4.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import InitialCasesPage from '../InitialCasesPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';

const CO_TAT_THE: FeatureFlag[] = [
  { key: 'TIM_KIEM_THE', label: 'Tìm kiếm dạng thẻ', description: null, enabled: false, domain: null, rolloutPct: 100 },
];

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canEdit: () => true }) }));
const m = vi.mocked(api) as unknown as Record<'get' | 'put' | 'delete', ReturnType<typeof vi.fn>>;

const HO_SO = [
  {
    id: 'c1', caseCode: '2026-11171', name: 'Trộm cắp xe máy', moTaChiTiet: 'Khoảng 22 giờ mất xe',
    nguonDon: 'Công an phường Bến Nghé', donViGiaiQuyet: 'Đội 2', caseProvenance: 'TRANSFERRED',
    ngayDeXuat: '2026-09-05T00:00:00.000Z', status: 'TIEP_NHAN',
  },
  {
    id: 'c2', caseCode: '2026-12', name: 'Lừa đảo', moTaChiTiet: null, nguonDon: null, donViGiaiQuyet: null,
    caseProvenance: 'FROM_PETITION', ngayDeXuat: null, status: 'TIEP_NHAN',
  },
];

const THONG_KE = {
  total: 900,
  byStatus: { TIEP_NHAN: 860, DANG_DIEU_TRA: 40 },
  ky: { ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN', tuNgay: null, denNgay: null },
};

let rong = false;
let tongDanhSach = 2;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/cases/stats')) return Promise.resolve({ data: THONG_KE });
    if (url.startsWith('/cases?')) {
      return Promise.resolve({ data: { data: rong ? [] : HO_SO, total: rong ? 0 : tongDanhSach } });
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

function dung(url = '/cases/initial', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/cases/initial', element: <InitialCasesPage /> }], {
    initialEntries: [url],
  });
  const trang = (
    <DeleteResourceModalProvider>
      <RouterProvider router={router} />
    </DeleteResourceModalProvider>
  );
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang);
}

describe('InitialCasesPage — dữ liệu thật, lọc ở máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('danh sách = vụ án Tiếp nhận, phân trang máy chủ (không tải 50 dòng lọc tại chỗ)', async () => {
    dung();
    await screen.findByTestId('initial-row-c1');
    expect(ds().get('status')).toBe('TIEP_NHAN');
    expect(ds().get('limit')).toBe('20');
    expect(ds().get('offset')).toBe('0');
    expect(tk().get('status')).toBeNull();
  });

  it('STT là mã hồ sơ dạng ngắn (không phải id cắt, không phải số dòng)', async () => {
    dung();
    const dong = await screen.findByTestId('initial-row-c1');
    expect(within(dong).getByText('26-11171')).toBeInTheDocument();
    expect(within(dong).queryByText('C1')).not.toBeInTheDocument();
  });

  it('cột đọc trường thật: tên, tóm tắt, nguồn đơn, đơn vị giải quyết, nguồn hồ sơ, ngày đề xuất', async () => {
    dung();
    const dong = await screen.findByTestId('initial-row-c1');
    for (const chu of ['Trộm cắp xe máy', 'Khoảng 22 giờ mất xe', 'Công an phường Bến Nghé', 'Đội 2', '05/09/2026']) {
      expect(within(dong).getByText(chu)).toBeInTheDocument();
    }
    expect(within(screen.getByTestId('initial-row-c2')).getByText('Khởi tố từ Đơn thư')).toBeInTheDocument();
  });

  it('KHÔNG còn Mức độ, Hạn xử lý, thẻ Quá hạn/Khẩn cấp (không có dữ liệu thật), không còn ô lọc quận gán cứng', async () => {
    dung();
    await screen.findByTestId('initial-row-c1');
    const bang = screen.getByTestId('initial-cases-table');
    for (const chu of ['Mức độ', 'Hạn xử lý', 'Bình thường']) {
      expect(within(bang).queryByText(chu)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Quá hạn')).not.toBeInTheDocument();
    expect(screen.queryByText('Khẩn cấp')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Quận Tân Bình' })).not.toBeInTheDocument();
  });

  it('thẻ Chờ nhận lấy số máy chủ đếm (byStatus.TIEP_NHAN), không đếm trên trang đang xem', async () => {
    dung();
    await waitFor(() => expect(screen.getByTestId('initial-kpi-cho-nhan')).toHaveTextContent('860'));
  });

  it('đang tải → thẻ số gạch; tải hỏng → báo lỗi, không nói "không có hồ sơ"', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    const { unmount } = dung();
    expect(await screen.findByTestId('initial-cases-loading')).toBeInTheDocument();
    expect(screen.getByTestId('initial-kpi-cho-nhan')).toHaveTextContent('—');
    unmount();
    m.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { success: false, error: { code: 'X', message: 'Máy chủ bận', details: [] } } },
    });
    dung();
    expect(await screen.findByTestId('initial-cases-load-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('initial-cases-empty')).not.toHaveTextContent('Không có hồ sơ chờ xử lý');
  });

  it('ngày gửi máy chủ (ngày gõ dở không gửi) và nhãn kỳ đổi theo', async () => {
    dung();
    await screen.findByTestId('initial-row-c1');
    fireEvent.change(screen.getByTestId('initial-from-date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('initial-to-date'), { target: { value: '0002-01-01' } });
    await waitFor(() => expect(ds().get('fromDate')).toBe('2026-09-01'));
    expect(ds().get('toDate')).toBeNull();
    expect(tk().get('fromDate')).toBe('2026-09-01');
    await waitFor(() => expect(screen.getByTestId('initial-cases-ky')).toHaveTextContent('Từ 01/09/2026'));
  });

  it('phân trang máy chủ: trang sau gửi offset 20', async () => {
    tongDanhSach = 860;
    dung();
    await screen.findByTestId('initial-row-c1');
    expect(screen.getByTestId('initial-cases-total')).toHaveTextContent('860');
    fireEvent.click(screen.getByTestId('initial-cases-next-page'));
    await waitFor(() => expect(ds().get('offset')).toBe('20'));
  });

  it('[rà mã P2] Xoá → hộp xoá chuẩn hỏi LÝ DO (máy chủ bắt buộc), gửi kèm lý do rồi tải lại; hỏng thì giữ hộp + lý do', async () => {
    // Bản cũ gọi DELETE không thân → DeleteCaseDto trả 400 "Lý do xóa bắt buộc" với mọi hồ sơ.
    m.delete.mockResolvedValueOnce({ data: {} });
    dung();
    await screen.findByTestId('initial-row-c1');
    const truoc = goi('/cases?').length;
    fireEvent.click(screen.getByTestId('btn-delete-c1'));
    fireEvent.change(await screen.findByTestId('input-ly-do-xoa'), { target: { value: 'Hồ sơ nhập trùng lặp' } });
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() =>
      expect(m.delete).toHaveBeenCalledWith('/cases/c1', { data: { reason: 'Hồ sơ nhập trùng lặp' } }),
    );
    await waitFor(() => expect(goi('/cases?').length).toBeGreaterThan(truoc));
    await waitFor(() => expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument());

    m.delete.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { success: false, error: { code: 'X', message: 'Hồ sơ đang được xử lý', details: [] } } },
    });
    fireEvent.click(await screen.findByTestId('btn-delete-c1'));
    fireEvent.change(await screen.findByTestId('input-ly-do-xoa'), { target: { value: 'Hồ sơ nhập trùng lặp' } });
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    expect(await screen.findByText(/Hồ sơ đang được xử lý/)).toBeInTheDocument();
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
  });

  it('Nhận xử lý → PUT trạng thái rồi tải lại; hỏng thì nói lý do', async () => {
    m.put.mockResolvedValueOnce({ data: {} });
    dung();
    await screen.findByTestId('initial-row-c1');
    const truoc = goi('/cases?').length;
    fireEvent.click(screen.getByTestId('btn-assign-c1'));
    fireEvent.click(await screen.findByTestId('btn-confirm-assign'));
    await waitFor(() => expect(m.put).toHaveBeenCalledWith('/cases/c1', { status: 'DANG_DIEU_TRA' }));
    await waitFor(() => expect(goi('/cases?').length).toBeGreaterThan(truoc));

    m.put.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { success: false, error: { code: 'X', message: 'Hồ sơ đã đổi', details: [] } } },
    });
    fireEvent.click(await screen.findByTestId('btn-assign-c1'));
    fireEvent.click(await screen.findByTestId('btn-confirm-assign'));
    expect(await screen.findByTestId('initial-assign-error')).toHaveTextContent('Hồ sơ đã đổi');
  });
});

describe('InitialCasesPage — ô tìm kiếm dạng thẻ (máy chủ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    tongDanhSach = 2;
    traDuLieu();
  });

  it('thẻ trên URL gửi xuống CẢ danh sách lẫn thống kê', async () => {
    dung('/cases/initial?initialCases_tk=donViGiaiQuyet~doi 2');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['donViGiaiQuyet~doi 2']));
    await waitFor(() => expect(tk().getAll('tk')).toEqual(['donViGiaiQuyet~doi 2']));
  });

  it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('initial-row-c1');
    fireEvent.change(o, { target: { value: 'trom' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['*~trom']));
  });

  it('không có kết quả với thẻ → nói rõ thẻ nào', async () => {
    rong = true;
    dung('/cases/initial?initialCases_tk=tenVuAn~khong co');
    const vung = await screen.findByTestId('initial-cases-empty');
    await waitFor(() => expect(vung).toHaveTextContent('Không tìm thấy với'));
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ Tên vụ án' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ gửi `search`', async () => {
    dung('/cases/initial', CO_TAT_THE);
    const o = await screen.findByTestId('initial-search');
    fireEvent.change(o, { target: { value: 'trộm' } });
    await waitFor(() => expect(ds().get('search')).toBe('trộm'));
  });
});
