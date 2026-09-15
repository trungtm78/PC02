import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { GlobalSearchBar } from '../GlobalSearchBar';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

const m = api.get as unknown as ReturnType<typeof vi.fn>;

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

/** Dữ liệu ĐÚNG hình API thật: vụ án `caseCode`/`name`, vụ việc `code`/`name`, đối tượng `type`. */
const DU_LIEU: Record<string, unknown[]> = {
  '/cases': [{ id: 'c1', caseCode: '2026-15', name: 'Trộm cắp tài sản', status: 'DANG_DIEU_TRA' }],
  '/petitions': [{ id: 'p1', stt: '2026-7', senderName: 'Nguyễn Văn An', status: 'DANG_XU_LY' }],
  '/subjects': [{ id: 's1', fullName: 'Lê Thị Bình', type: 'VICTIM' }],
  '/incidents': [{ id: 'i1', code: '2026-3', name: 'Mất xe máy', status: 'DANG_XAC_MINH' }],
};

function ViTri() {
  const loc = useLocation();
  return <output data-testid="vi-tri">{loc.pathname + loc.search}</output>;
}

function dung(flags?: FeatureFlag[]) {
  const cay = (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <GlobalSearchBar />
              <ViTri />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
  render(flags ? <FeatureFlagsProvider initialFlags={flags}>{cay}</FeatureFlagsProvider> : cay);
  return screen.getByTestId('global-search-input');
}

/** Tham số của lượt gọi cuối tới một API. */
function thamSo(duong: string): Record<string, unknown> {
  const goi = m.mock.calls.filter((c) => (c as [string])[0] === duong);
  const cuoi = goi[goi.length - 1] as [string, { params?: Record<string, unknown> }] | undefined;
  return cuoi?.[1]?.params ?? {};
}

/** Địa chỉ hiện tại tách thành đường + tham số đã giải mã. */
function viTri(): { duong: string; ts: URLSearchParams } {
  const s = screen.getByTestId('vi-tri').textContent ?? '';
  const [duong, q = ''] = s.split('?');
  return { duong, ts: new URLSearchParams(q) };
}

async function goVaCho(o: HTMLElement, chu: string) {
  fireEvent.change(o, { target: { value: chu } });
  await waitFor(() => expect(screen.getByTestId('search-dropdown')).toHaveTextContent('Mất xe máy'));
}

/**
 * M6: thanh tìm kiếm toàn cục gửi thẻ "*" (bỏ dấu, cùng quy tắc mọi màn danh sách) và mở đúng chỗ.
 *
 * [lỗi có sẵn] "Xem tất cả" gửi `?search=` mà KHÔNG màn nào đọc → ra danh sách chưa lọc. Nhãn đọc
 * `caseNumber`/`incidentName` mà API trả `caseCode`/`name` → chỉ hiện id. Bấm một vụ việc/đối tượng
 * không mở hồ sơ ấy. Tô sáng chỉ khi gõ đúng dấu.
 */
describe('GlobalSearchBar — thẻ tìm kiếm', () => {
  beforeEach(() => {
    m.mockReset();
    m.mockImplementation((url: string) => Promise.resolve({ data: { data: DU_LIEU[url] ?? [] } }));
  });

  it('gửi thẻ "*" tới CẢ bốn API, không gửi `search`', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    for (const duong of ['/cases', '/petitions', '/subjects', '/incidents']) {
      expect(thamSo(duong).tk).toEqual(['*~nguyen']);
      expect(thamSo(duong).search).toBeUndefined();
    }
  });

  it('nhãn theo đúng hình API: vụ án "mã — tên", vụ việc "mã — tên"', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    const menu = screen.getByTestId('search-dropdown');
    expect(menu).toHaveTextContent('2026-15 — Trộm cắp tài sản');
    expect(menu).toHaveTextContent('2026-3 — Mất xe máy');
    expect(menu).toHaveTextContent('Bị hại');
  });

  it('bấm một vụ việc → mở chính hồ sơ ấy', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    fireEvent.click(screen.getByText(/Mất xe máy/));
    await waitFor(() => expect(viTri().duong).toBe('/vu-viec/i1'));
  });

  it('bấm một đối tượng bị hại → danh sách Bị hại lọc đúng họ tên ấy', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    fireEvent.click(screen.getByText(/Lê Thị Bình/));
    await waitFor(() => expect(viTri().duong).toBe('/people/victims'));
    expect(viTri().ts.getAll('victims_tk')).toEqual(['hoTen~Lê Thị Bình']);
  });

  it('"Xem tất cả" nhóm Vụ án → danh sách Vụ án mang thẻ "*" (màn đọc được)', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    const nhom = screen.getByText('Vụ án').closest('div')?.parentElement as HTMLElement;
    fireEvent.click(within(nhom).getByRole('button', { name: /Xem tất cả/ }));
    await waitFor(() => expect(viTri().duong).toBe('/cases'));
    expect(viTri().ts.getAll('cases_tk')).toEqual(['*~nguyen']);
    expect(viTri().ts.get('search')).toBeNull();
  });

  it('tô sáng không phân biệt dấu: gõ "nguyen" tô "Nguyễn"', async () => {
    const o = dung();
    await goVaCho(o, 'nguyen');
    const marks = screen.getAllByText((_, el) => el?.tagName === 'MARK');
    expect(marks.map((x) => x.textContent)).toContain('Nguyễn');
  });

  it('cờ tắt → gửi `search` như cũ', async () => {
    const o = dung(CO_TAT_THE);
    await goVaCho(o, 'nguyen');
    expect(thamSo('/cases').search).toBe('nguyen');
    expect(thamSo('/cases').tk).toBeUndefined();
  });
});
