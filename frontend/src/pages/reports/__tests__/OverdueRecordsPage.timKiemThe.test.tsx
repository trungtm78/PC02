import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import OverdueRecordsPage from '../OverdueRecordsPage';
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

const HO_SO = {
  id: 'p1',
  recordNumber: '2026-15',
  recordType: 'petition',
  title: 'Đơn tố cáo lừa đảo',
  assignedTo: 'Chưa phân công',
  unit: 'Đội 2',
  dueDate: '2026-09-01T00:00:00.000Z',
  receivedDate: '2026-08-01T00:00:00.000Z',
  daysOverdue: 14,
  status: 'DANG_XU_LY',
  priority: 'medium',
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url === '/reports/overdue') {
      const data = rong ? [] : [HO_SO];
      return Promise.resolve({ data: { success: true, data, total: data.length } });
    }
    return Promise.resolve({ data: {} });
  });
}

/** Tham số của lượt gọi CUỐI tới `/reports/overdue`. */
function thamSoCuoi(): Record<string, unknown> {
  const goi = m.get.mock.calls.filter((c) => (c as [string])[0] === '/reports/overdue');
  const cuoi = goi[goi.length - 1] as [string, { params?: Record<string, unknown> }] | undefined;
  return cuoi?.[1]?.params ?? {};
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <OverdueRecordsPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: Hồ sơ trễ hạn (gộp Vụ án + Vụ việc + Đơn thư) tìm ở MÁY CHỦ bằng thẻ — "*" và khoá CHUNG ba khai
 * (STT, người gửi, tóm tắt, đơn vị giải quyết, người nhập…). Khoá chỉ có ở một loại (trạng thái, điều
 * tra viên) thì máy chủ 400 — giao diện không được gửi. Thẻ trên URL `overdue_tk`.
 */
describe('OverdueRecordsPage — ô tìm kiếm dạng thẻ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rong = false;
    traDuLieu();
  });

  it('gõ rồi Enter → gửi thẻ "tất cả các cột", không gửi `search`', async () => {
    dung();
    const o = await screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    fireEvent.change(o, { target: { value: 'nguyen' } });
    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['*~nguyen']));
    expect(thamSoCuoi().search).toBeUndefined();
  });

  it('thẻ khoá chung trên URL (`overdue_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?overdue_tk=nguoiGui~an');
    await waitFor(() => expect(thamSoCuoi().tk).toEqual(['nguoiGui~an']));
  });

  it('khoá chỉ có ở một loại hồ sơ (trạng thái) → thẻ đỏ, KHÔNG gửi (không 400 cả danh sách)', async () => {
    dung('/?overdue_tk=trangThai~DANG_XU_LY');
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(thamSoCuoi().tk).toBeUndefined();
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?overdue_tk=stt~2026-99');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ STT' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ, gửi `search`', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText('Tìm kiếm theo số hồ sơ, tiêu đề, người xử lý...');
    fireEvent.change(o, { target: { value: 'an' } });
    await waitFor(() => expect(thamSoCuoi().search).toBe('an'));
    expect(thamSoCuoi().tk).toBeUndefined();
  });
});
