import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ExportReportsPage from '../ExportReportsPage';
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

const DON = {
  id: 'p1',
  stt: '2026-15',
  receivedDate: '2026-09-01T02:00:00.000Z',
  senderName: 'Nguyễn Văn An',
  suspectedPerson: '',
  summary: 'Tố cáo lừa đảo',
  unit: 'Đội 2',
  status: 'DANG_XU_LY',
  enteredBy: null,
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/petitions?')) {
      const data = rong ? [] : [DON];
      return Promise.resolve({ data: { data, total: data.length } });
    }
    return Promise.resolve({ data: {} });
  });
}

/** Tham số (đã giải mã) của lượt gọi CUỐI tới danh sách `/petitions?`. */
function thamSoCuoi(): URLSearchParams {
  const goi = m.get.mock.calls
    .map((c) => (c as [string])[0])
    .filter((u) => u.startsWith('/petitions?'));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <ExportReportsPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: Xuất báo cáo (danh sách đơn thư để xuất) tìm ở MÁY CHỦ bằng thẻ của khai Đơn thư — máy chủ
 * `/petitions` đã nhận thẻ, trước đây màn chỉ gửi `search`. Thẻ trên URL `exportReports_tk`.
 */
describe('ExportReportsPage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`, về trang đầu', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    fireEvent.change(o, { target: { value: 'nguyen' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['*~nguyen']));
    expect(thamSoCuoi().get('search')).toBeNull();
    expect(thamSoCuoi().get('offset')).toBe('0');
  });

  it('thẻ Trạng thái trên URL (`exportReports_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?exportReports_tk=trangThai~DANG_XU_LY');
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['trangThai~DANG_XU_LY']));
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?exportReports_tk=nguoiGui~khong co');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(
      within(vung).getByRole('button', {
        name: 'Bỏ thẻ Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
      }),
    ).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, Enter gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText(
      'Tìm kiếm theo STT, người gửi, nghi vấn đối tượng, tóm tắt...',
    );
    fireEvent.change(o, { target: { value: 'an' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().get('search')).toBe('an'));
    expect(thamSoCuoi().getAll('tk')).toEqual([]);
  });

  /**
   * [lỗi có sẵn — codex M6] Nút "Xuất Excel" dựng tham số riêng (ids/fromDate/toDate/unit) nên KHÔNG
   * mang ô tìm: màn lọc bằng thẻ còn 3 đơn, tệp xuất ra là mọi đơn khớp ngày/đơn vị. Không tích dòng
   * nào thì đó chính là "xuất cái đang xem".
   */
  it('bấm "Xuất Excel" khi đang lọc bằng thẻ → lượt xuất mang CÙNG thẻ', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    m.get.mockImplementation((url: string) => {
      if (url === '/petitions/export') return Promise.resolve({ data: new Blob(['x']) });
      if (url.startsWith('/petitions?')) {
        return Promise.resolve({ data: { data: [DON], total: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
    dung('/?exportReports_tk=nguoiGui~nguyen');
    await screen.findByText('2026-15');

    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }));

    await waitFor(() => {
      const goi = m.get.mock.calls.filter((c) => (c as [string])[0] === '/petitions/export');
      expect(goi.length).toBeGreaterThan(0);
      const ts = (goi[goi.length - 1] as [string, { params?: Record<string, unknown> }])[1]?.params;
      expect(ts?.tk).toEqual(['nguoiGui~nguyen']);
    });
  });
});
