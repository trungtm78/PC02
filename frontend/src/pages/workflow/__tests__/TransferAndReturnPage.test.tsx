/**
 * TransferAndReturnPage — Chuyển đội / Trả hồ sơ.
 *
 * 18/09/2026 màn đọc dữ liệu THẬT và các nút làm THẬT. Trước đó:
 *   - tải 50 hồ sơ mỗi loại rồi gộp, lọc và phân trang tại chỗ;
 *   - "Mã hồ sơ" của Vụ án là id cắt 8 ký tự; "Đội hiện tại" đọc `unit`/`unitId` (prod rỗng);
 *   - "Chuyển đội" GHI ĐÈ ô chữ `unit` bằng tên đội và nhét lý do vào `metadata` — prod 0 bản ghi nào
 *     có `metadata.transferReason`, tức chưa từng chạy được; đúng đường là PATCH `/:id/assign`;
 *   - "Trả hồ sơ" và "Xuất Excel" không gọi API nào.
 *
 * Đo prod 18/09 (chỉ đọc): 215 tổ (192 đang hoạt động); vụ án gắn tổ 3.179, vụ việc 4.141, đơn thư
 * 36.476; trạng thái "Đã chuyển đơn vị khác" có ở Vụ án (10) và Vụ việc (220), Đơn thư KHÔNG có.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import TransferAndReturnPage from '../TransferAndReturnPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

const CO_TAT_THE: FeatureFlag[] = [
  { key: 'TIM_KIEM_THE', label: 'Tìm kiếm dạng thẻ', description: null, enabled: false, domain: null, rolloutPct: 100 },
];

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), put: vi.fn() } }));
const m = vi.mocked(api) as unknown as Record<'get' | 'patch' | 'put', ReturnType<typeof vi.fn>>;

const VU_AN = [
  {
    id: 'c1', caseCode: '2026-11171', name: 'Trộm cắp xe máy', status: 'DANG_DIEU_TRA',
    ngayDeXuat: '2026-09-01T00:00:00.000Z',
    assignedTeam: { id: 't1', name: 'Đội 2' },
    investigator: { firstName: 'Văn A', lastName: 'Nguyễn' },
  },
];
const VU_VIEC = [
  {
    id: 'i1', code: '2026-9706', name: 'Mất trộm xe', status: 'TIEP_NHAN',
    ngayDeXuat: '2026-08-01T00:00:00.000Z',
    assignedTeam: { id: 't2', name: 'Tổ 3' },
    investigator: null,
  },
];
const DON_THU = [
  {
    id: 'p1', stt: '2026-1', summary: 'Đơn tố giác', detailContent: 'Đơn tố giác', status: 'MOI_TIEP_NHAN',
    ngayDeXuat: '2026-07-01T00:00:00.000Z',
    assignedTeam: { id: 't1', name: 'Đội 2' },
    assignedTo: null,
  },
];
const TO = [
  { id: 't1', name: 'Đội 2' },
  { id: 't9', name: 'Đội 5' },
];

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/cases?')) return Promise.resolve({ data: { data: VU_AN, total: 3179 } });
    if (url.startsWith('/incidents?')) return Promise.resolve({ data: { data: VU_VIEC, total: 4141 } });
    if (url.startsWith('/petitions?')) return Promise.resolve({ data: { data: DON_THU, total: 36476 } });
    if (url.startsWith('/teams')) return Promise.resolve({ data: { data: TO } });
    return Promise.resolve({ data: [] });
  });
  m.patch.mockResolvedValue({ data: {} });
  m.put.mockResolvedValue({ data: {} });
}

const goi = (duong: string) => m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
function thamSoCuoi(duong: string): URLSearchParams {
  const g = goi(duong);
  return new URLSearchParams((g[g.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/workflow/transfer', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/workflow/transfer', element: <TransferAndReturnPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang);
}

describe('TransferAndReturnPage — dữ liệu thật, lọc ở máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    traDuLieu();
  });

  it('gọi cả ba nguồn ở máy chủ, KHÔNG tải 50 dòng mỗi loại để lọc tại chỗ', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    expect(goi('/cases?limit=50')).toEqual([]);
    for (const d of ['/cases?', '/incidents?', '/petitions?']) {
      expect(thamSoCuoi(d).get('limit')).toBe('20');
    }
  });

  it('cột đọc trường thật: mã hồ sơ, tên, ĐỘI hiện tại, người phụ trách, ngày đề xuất, trạng thái', async () => {
    dung();
    const dong = await screen.findByTestId('chuyen-tra-row-c1');
    expect(within(dong).getByText('26-11171')).toBeInTheDocument();
    expect(within(dong).getByText('Trộm cắp xe máy')).toBeInTheDocument();
    expect(within(dong).getByText('Đội 2')).toBeInTheDocument();
    expect(within(dong).getByText(/Nguyễn Văn A/)).toBeInTheDocument();
    expect(within(dong).getByText('01/09/2026')).toBeInTheDocument();
    expect(within(dong).getByText('Đang điều tra')).toBeInTheDocument();
    // Vụ việc và Đơn thư cùng bảng, mỗi dòng nói rõ loại hồ sơ.
    expect(within(screen.getByTestId('chuyen-tra-row-i1')).getByText('26-9706')).toBeInTheDocument();
    expect(within(screen.getByTestId('chuyen-tra-row-p1')).getByText('26-1')).toBeInTheDocument();
  });

  it('tổng hồ sơ = tổng cả ba nguồn từ máy chủ, không đếm trên trang', async () => {
    dung();
    await waitFor(() =>
      expect(screen.getByTestId('chuyen-tra-tong')).toHaveTextContent(String(3179 + 4141 + 36476)),
    );
  });

  it('lọc loại hồ sơ → chỉ hỏi đúng nguồn ấy', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    const truocIncidents = goi('/incidents?').length;
    fireEvent.change(screen.getByTestId('loc-loai-ho-so'), { target: { value: 'Vụ án' } });
    await waitFor(() => expect(goi('/cases?').length).toBeGreaterThan(1));
    expect(goi('/incidents?').length).toBe(truocIncidents);
    expect(screen.queryByTestId('chuyen-tra-row-i1')).not.toBeInTheDocument();
  });

  it('thẻ tìm "tất cả các cột" gửi xuống CẢ BA nguồn', async () => {
    dung('/workflow/transfer?transferReturn_tk=*~trom');
    await waitFor(() => expect(thamSoCuoi('/cases?').getAll('tk')).toEqual(['*~trom']));
    expect(thamSoCuoi('/incidents?').getAll('tk')).toEqual(['*~trom']);
    expect(thamSoCuoi('/petitions?').getAll('tk')).toEqual(['*~trom']);
  });

  it('Chuyển đội gọi PATCH /:id/assign với TỔ THẬT, không ghi đè ô chữ đơn vị', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    fireEvent.click(screen.getByTestId('chon-c1'));
    fireEvent.click(screen.getByTestId('btn-chuyen-doi'));
    fireEvent.change(await screen.findByTestId('chon-to-nhan'), { target: { value: 't9' } });
    fireEvent.click(screen.getByTestId('btn-xac-nhan-chuyen'));
    await waitFor(() => expect(m.patch).toHaveBeenCalledWith('/cases/c1/assign', { assignedTeamId: 't9' }));
    expect(m.put).not.toHaveBeenCalled();
  });

  it('Chuyển đội hỏng → nói rõ hồ sơ nào hỏng, không báo thành công giả', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    m.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { success: false, error: { code: 'X', message: 'Không đủ quyền phân công', details: [] } } },
    });
    fireEvent.click(screen.getByTestId('chon-c1'));
    fireEvent.click(screen.getByTestId('btn-chuyen-doi'));
    fireEvent.change(await screen.findByTestId('chon-to-nhan'), { target: { value: 't9' } });
    fireEvent.click(screen.getByTestId('btn-xac-nhan-chuyen'));
    expect(await screen.findByTestId('ket-qua-chuyen')).toHaveTextContent('Không đủ quyền phân công');
  });

  it('Trả hồ sơ: chỉ bật cho Vụ án/Vụ việc (Đơn thư không có trạng thái "đã chuyển đơn vị")', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-p1');
    fireEvent.click(screen.getByTestId('chon-p1'));
    expect(screen.getByTestId('btn-tra-ho-so')).toBeDisabled();
    expect(screen.getByTestId('btn-tra-ho-so-ly-do')).toHaveTextContent(/Đơn thư/);
    fireEvent.click(screen.getByTestId('chon-p1'));
    fireEvent.click(screen.getByTestId('chon-i1'));
    expect(screen.getByTestId('btn-tra-ho-so')).toBeEnabled();
  });

  it('Trả hồ sơ ghi trạng thái ĐÃ CHUYỂN ĐƠN VỊ và đơn vị nhận', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-i1');
    fireEvent.click(screen.getByTestId('chon-i1'));
    fireEvent.click(screen.getByTestId('btn-tra-ho-so'));
    fireEvent.change(await screen.findByTestId('tra-don-vi-nhan'), { target: { value: 'Công an Quận 1' } });
    fireEvent.click(screen.getByTestId('btn-xac-nhan-tra'));
    await waitFor(() =>
      expect(m.put).toHaveBeenCalledWith('/incidents/i1', {
        status: 'DA_CHUYEN_DON_VI',
        chuyenDenDonVi: 'Công an Quận 1',
      }),
    );
  });

  it('KHÔNG còn nút Xuất Excel (không có API phía sau)', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    expect(screen.queryByTestId('export-excel-btn')).not.toBeInTheDocument();
  });

  it('đang tải → báo đang tải; tải hỏng → nói lý do, không nói "không có hồ sơ"', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    const { unmount } = dung();
    expect(await screen.findByTestId('chuyen-tra-loading')).toBeInTheDocument();
    unmount();
    m.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { success: false, error: { code: 'X', message: 'Máy chủ bận', details: [] } } },
    });
    dung();
    expect(await screen.findByTestId('transfer-load-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('chuyen-tra-empty')).not.toHaveTextContent('Không tìm thấy hồ sơ');
  });

  it('phân trang gộp: trang sau lấy đủ dòng của cả ba nguồn', async () => {
    dung();
    await screen.findByTestId('chuyen-tra-row-c1');
    fireEvent.click(screen.getByTestId('chuyen-tra-next-page'));
    await waitFor(() => expect(thamSoCuoi('/cases?').get('limit')).toBe('40'));
    // Gộp ba nguồn rồi cắt: mỗi nguồn phải lấy tới hết trang đang xem, không phải chỉ 20 dòng đầu.
    expect(thamSoCuoi('/incidents?').get('limit')).toBe('40');
    expect(thamSoCuoi('/petitions?').get('limit')).toBe('40');
  });

  it('cờ tắt → ô chữ cũ gửi `search` cho cả ba nguồn', async () => {
    dung('/workflow/transfer', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'trom' } });
    await waitFor(() => expect(thamSoCuoi('/cases?').get('search')).toBe('trom'));
    expect(thamSoCuoi('/petitions?').get('search')).toBe('trom');
  });
});
