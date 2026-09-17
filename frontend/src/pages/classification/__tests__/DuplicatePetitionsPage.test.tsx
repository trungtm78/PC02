/**
 * DuplicatePetitionsPage — Đơn trùng.
 *
 * 18/09/2026 màn có NGUỒN DỮ LIỆU THẬT. Trước đó màn tải `limit=100` đơn bất kỳ rồi hiện chúng như đơn
 * trùng: cột "Tiêu chí trùng" và "Hồ sơ gốc gợi ý" luôn rỗng, "độ tương đồng %" và các nút hợp nhất /
 * tách / so sánh không có API nào phía sau. Logic tìm trùng thật chỉ nằm trong đường xuất Excel.
 *
 * Nay gọi `/petitions/duplicates`: gom theo cột chuẩn hoá (giữ dấu thanh) của CSDL, phân trang theo
 * NHÓM, mỗi nhóm kèm đơn tiếp nhận sớm nhất làm hồ sơ gốc. Đo prod 17/09 (47.352 đơn): 7.571 nhóm /
 * 29.788 đơn theo họ tên; nhóm "nặc danh" (183 đơn) bị loại.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DuplicatePetitionsPage from '../DuplicatePetitionsPage';
import { api } from '@/lib/api';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

const CO_TAT_THE: FeatureFlag[] = [
  { key: 'TIM_KIEM_THE', label: 'Tìm kiếm dạng thẻ', description: null, enabled: false, domain: null, rolloutPct: 100 },
];

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const m = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

const NHOM = {
  criteria: 'senderName',
  total: 7571,
  ky: { ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN', tuNgay: null, denNgay: null },
  data: [
    {
      giaTri: 'lê thị nhâm',
      soDon: 3,
      goc: { id: 'p1', stt: '2026-1', senderName: 'Lê thị Nhâm', ngayDeXuat: '2026-01-01T00:00:00.000Z', status: 'MOI_TIEP_NHAN' },
      dons: [
        { id: 'p1', stt: '2026-1', senderName: 'Lê thị Nhâm', detailContent: 'Đơn đầu', ngayDeXuat: '2026-01-01T00:00:00.000Z', status: 'MOI_TIEP_NHAN' },
        { id: 'p2', stt: '2026-20', senderName: 'Lê Thị Nhâm', detailContent: 'Đơn sau', ngayDeXuat: '2026-03-01T00:00:00.000Z', status: 'DANG_XU_LY' },
        { id: 'p3', stt: '2026-30', senderName: 'LÊ THỊ NHÂM', detailContent: null, ngayDeXuat: null, status: 'DA_GIAI_QUYET' },
      ],
    },
  ],
};

let rong = false;
let catCut = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/petitions/duplicates')) {
      if (rong) return Promise.resolve({ data: { ...NHOM, total: 0, data: [] } });
      if (catCut) {
        return Promise.resolve({
          data: { ...NHOM, data: [{ ...NHOM.data[0], soDon: 57 }] },
        });
      }
      return Promise.resolve({ data: NHOM });
    }
    return Promise.resolve({ data: [] });
  });
}

const goi = (duong: string) => m.get.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(duong));
function thamSoCuoi(duong: string): URLSearchParams {
  const g = goi(duong);
  return new URLSearchParams((g[g.length - 1] ?? '').split('?')[1] ?? '');
}
const ds = () => thamSoCuoi('/petitions/duplicates?');

function dung(url = '/classification/duplicates', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/classification/duplicates', element: <DuplicatePetitionsPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang);
}

describe('DuplicatePetitionsPage — nhóm trùng thật', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    catCut = false;
    traDuLieu();
  });

  it('gọi /petitions/duplicates (không còn tải 100 đơn bất kỳ), mặc định gom theo họ tên', async () => {
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    expect(goi('/petitions?')).toEqual([]);
    expect(ds().get('criteria')).toBe('senderName');
    expect(ds().get('limit')).toBe('20');
    expect(ds().get('offset')).toBe('0');
  });

  it('mỗi nhóm nói rõ TRÙNG THEO giá trị gì và có bao nhiêu đơn', async () => {
    dung();
    const khoi = await screen.findByTestId('nhom-trung-le-thi-nham');
    expect(khoi).toHaveTextContent('lê thị nhâm');
    expect(khoi).toHaveTextContent('3');
  });

  it('đánh dấu HỒ SƠ GỐC = đơn tiếp nhận sớm nhất, các đơn còn lại là trùng theo sau', async () => {
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    expect(screen.getByTestId('don-trung-p1')).toHaveTextContent('Hồ sơ gốc');
    expect(screen.getByTestId('don-trung-p2')).not.toHaveTextContent('Hồ sơ gốc');
    expect(screen.getByTestId('don-trung-p2')).toHaveTextContent('26-1');
  });

  it('cột đọc trường thật: mã đơn, người gửi, tóm tắt, ngày đề xuất, trạng thái', async () => {
    dung();
    const dong = await screen.findByTestId('don-trung-p2');
    expect(within(dong).getByText('26-20')).toBeInTheDocument();
    expect(within(dong).getByText('Lê Thị Nhâm')).toBeInTheDocument();
    expect(within(dong).getByText('Đơn sau')).toBeInTheDocument();
    expect(within(dong).getByText('01/03/2026')).toBeInTheDocument();
    expect(within(dong).getByText('Đang xử lý')).toBeInTheDocument();
  });

  it('[rà mã P3] nhóm to hơn số đơn máy chủ trả → NÓI RÕ đang hiện bao nhiêu, không cắt cụt âm thầm', async () => {
    dung();
    const khoi = await screen.findByTestId('nhom-trung-le-thi-nham');
    // NHOM mẫu: soDon 3 nhưng chỉ trả 3 đơn → không báo. Đổi sang nhóm bị cắt.
    expect(khoi).not.toHaveTextContent(/Đang hiện/);
  });

  it('KHÔNG còn độ tương đồng %, nút hợp nhất/tách/so sánh (không có API phía sau)', async () => {
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    for (const chu of [/Độ tương đồng/i, /Hợp nhất/i, /Tách riêng/i, /So sánh/i]) {
      expect(screen.queryByText(chu)).not.toBeInTheDocument();
    }
  });

  it('đổi tiêu chí gom → gửi xuống máy chủ, về trang đầu', async () => {
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    fireEvent.change(screen.getByTestId('chon-tieu-chi'), { target: { value: 'senderPhone' } });
    await waitFor(() => expect(ds().get('criteria')).toBe('senderPhone'));
    expect(ds().get('offset')).toBe('0');
  });

  it('ngày, trạng thái gửi máy chủ; ngày gõ dở không gửi; cột ngày cố định Ngày đề xuất', async () => {
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    fireEvent.change(screen.getByTestId('loc-tu-ngay'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByTestId('loc-den-ngay'), { target: { value: '0002-01-01' } });
    fireEvent.change(screen.getByTestId('loc-trang-thai'), { target: { value: 'DANG_XU_LY' } });
    await waitFor(() => expect(ds().get('status')).toBe('DANG_XU_LY'));
    expect(ds().get('fromDate')).toBe('2026-01-01');
    expect(ds().get('toDate')).toBeNull();
    expect(ds().get('thongKeTruongNgay')).toBe('NGAY_TIEP_NHAN');
  });

  it('thẻ số: số NHÓM trùng lấy từ máy chủ, không đếm trên trang; phân trang theo nhóm', async () => {
    dung();
    await waitFor(() => expect(screen.getByTestId('don-trung-tong-nhom')).toHaveTextContent('7571'));
    fireEvent.click(screen.getByTestId('don-trung-next-page'));
    await waitFor(() => expect(ds().get('offset')).toBe('20'));
  });

  it('đang tải → thẻ gạch; tải hỏng → báo lỗi, không nói "không có nhóm trùng"', async () => {
    m.get.mockImplementation(() => new Promise(() => {}));
    const { unmount } = dung();
    expect(await screen.findByTestId('don-trung-loading')).toBeInTheDocument();
    expect(screen.getByTestId('don-trung-tong-nhom')).toHaveTextContent('—');
    unmount();
    m.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { success: false, error: { code: 'X', message: 'Máy chủ bận', details: [] } } },
    });
    dung();
    expect(await screen.findByTestId('duplicate-petitions-load-error')).toHaveTextContent('Máy chủ bận');
    expect(screen.getByTestId('don-trung-empty')).not.toHaveTextContent('Không có nhóm trùng');
  });

  it('rỗng → nói không có nhóm trùng', async () => {
    rong = true;
    dung();
    expect(await screen.findByTestId('don-trung-empty')).toHaveTextContent(/Không có nhóm trùng/);
  });

  it('xuất Excel gửi CÙNG tham số đang lọc', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    dung();
    await screen.findByTestId('nhom-trung-le-thi-nham');
    fireEvent.change(screen.getByTestId('chon-tieu-chi'), { target: { value: 'senderAddress' } });
    await waitFor(() => expect(ds().get('criteria')).toBe('senderAddress'));
    m.get.mockResolvedValueOnce({ data: new Blob() });
    fireEvent.click(screen.getByTestId('export-excel-btn'));
    await waitFor(() => expect(goi('/petitions/export/duplicates?').length).toBe(1));
    expect(thamSoCuoi('/petitions/export/duplicates?').get('criteria')).toBe('senderAddress');
  });
});

describe('DuplicatePetitionsPage — ô tìm kiếm dạng thẻ (máy chủ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    catCut = false;
    traDuLieu();
  });

  it('thẻ trên URL gửi xuống máy chủ', async () => {
    dung('/classification/duplicates?duplicatePetitions_tk=nguoiGui~le thi');
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['nguoiGui~le thi']));
  });

  it('gõ rồi Enter → thẻ "tất cả các cột"', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    await screen.findByTestId('nhom-trung-le-thi-nham');
    fireEvent.change(o, { target: { value: 'nham' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(ds().getAll('tk')).toEqual(['*~nham']));
  });

  it('cờ tắt → ô chữ cũ gửi `search`', async () => {
    dung('/classification/duplicates', CO_TAT_THE);
    const o = await screen.findByTestId('quick-search-input');
    fireEvent.change(o, { target: { value: 'nhâm' } });
    await waitFor(() => expect(ds().get('search')).toBe('nhâm'));
  });
});

describe('DuplicatePetitionsPage — nhóm bị cắt bớt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    catCut = true;
    traDuLieu();
  });

  it('[rà mã P3] nhóm 57 đơn mà máy chủ trả 3 → nói rõ "Đang hiện 3 / 57"', async () => {
    dung();
    const khoi = await screen.findByTestId('nhom-trung-le-thi-nham');
    expect(khoi).toHaveTextContent('Đang hiện 3 / 57');
  });
});
