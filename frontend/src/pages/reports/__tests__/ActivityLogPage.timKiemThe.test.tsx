import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ActivityLogPage from '../ActivityLogPage';
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

const BAN_GHI = {
  id: 'a1',
  action: 'CASE_CREATED',
  subject: 'Case',
  subjectId: 'c1',
  userId: 'u1',
  ipAddress: '127.0.0.1',
  createdAt: '2026-09-01T02:00:00.000Z',
  user: { id: 'u1', firstName: 'Nguyễn Văn', lastName: 'An', username: 'an.nguyen' },
  metadata: null,
  changedFields: [],
};

let rong = false;

function traDuLieu() {
  m.get.mockImplementation((url: string) => {
    if (url.startsWith('/audit-logs/export.csv')) return Promise.resolve({ data: 'csv' });
    if (url.startsWith('/audit-logs?')) {
      const data = rong ? [] : [BAN_GHI];
      return Promise.resolve({ data: { data, total: data.length } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

/** Tham số (đã giải mã) của lượt gọi CUỐI tới một đường bắt đầu bằng `dau`. */
function thamSoCuoi(dau = '/audit-logs?'): URLSearchParams {
  const goi = m.get.mock.calls.map((c) => (c as [string])[0]).filter((u) => u.startsWith(dau));
  return new URLSearchParams((goi[goi.length - 1] ?? '').split('?')[1] ?? '');
}

function dung(url = '/', flags?: FeatureFlag[]) {
  const router = createMemoryRouter([{ path: '/', element: <ActivityLogPage /> }], {
    initialEntries: [url],
  });
  const trang = <RouterProvider router={router} />;
  return render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
}

/**
 * M6: Nhật ký hoạt động tìm ở MÁY CHỦ bằng thẻ — "*" ra cả tên người thực hiện, chọn cột (thời gian,
 * người thực hiện, thao tác, loại/mã đối tượng, IP). Thẻ trên URL `activityLog_tk`.
 *
 * [lỗi có sẵn] Màn gửi `search` rồi LỌC LẠI trên trang đã tải theo tên người/mã/nhãn thao tác, so chữ
 * có dấu: máy chủ trả đúng dòng mà trình duyệt giấu đi.
 */
describe('ActivityLogPage — ô tìm kiếm dạng thẻ', () => {
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
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['*~nguyen']));
    expect(thamSoCuoi().get('search')).toBeNull();
  });

  it('thẻ trên URL (`activityLog_tk`) → gửi xuống máy chủ khi mở trang', async () => {
    dung('/?activityLog_tk=nguoiThucHien~an');
    await waitFor(() => expect(thamSoCuoi().getAll('tk')).toEqual(['nguoiThucHien~an']));
  });

  it('dòng máy chủ trả về KHÔNG bị trình duyệt lọc lại (tên có dấu, gõ không dấu)', async () => {
    dung('/?activityLog_tk=*~nguyen');
    expect((await screen.findAllByText('Nguyễn Văn An')).length).toBeGreaterThan(0);
  });

  it('xuất CSV mang cùng thẻ đang áp', async () => {
    const taoUrl = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: taoUrl, revokeObjectURL: vi.fn() });
    dung('/?activityLog_tk=thaoTac~CASE_CREATED');
    await screen.findAllByText('Nguyễn Văn An');
    fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/ }));
    await waitFor(() =>
      expect(thamSoCuoi('/audit-logs/export.csv').getAll('tk')).toEqual([
        'thaoTac~CASE_CREATED',
      ]),
    );
  });

  it('còn thẻ mà không có kết quả → nói rõ đang lọc bởi thẻ nào', async () => {
    rong = true;
    dung('/?activityLog_tk=ip~10.0.0.9');
    const cau = await screen.findByText('Không tìm thấy với:');
    const vung = cau.parentElement as HTMLElement;
    expect(within(vung).getByRole('button', { name: 'Bỏ thẻ IP' })).toBeInTheDocument();
  });

  it('cờ tắt → ô chữ cũ gửi `search`, dòng máy chủ trả về vẫn hiện (không lọc lại theo chữ có dấu)', async () => {
    dung('/', CO_TAT_THE);
    const o = await screen.findByPlaceholderText(
      'Tìm kiếm theo người thực hiện, đối tượng, mô tả...',
    );
    fireEvent.change(o, { target: { value: 'nguyen' } });
    await waitFor(() => expect(thamSoCuoi().get('search')).toBe('nguyen'));
    expect(thamSoCuoi().getAll('tk')).toEqual([]);
    expect((await screen.findAllByText('Nguyễn Văn An')).length).toBeGreaterThan(0);
  });
});
