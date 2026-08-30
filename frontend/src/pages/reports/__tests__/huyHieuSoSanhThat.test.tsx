import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Huy hiệu so sánh trên hai màn báo cáo phải đến TỪ DỮ LIỆU.
 *
 * ── Thay cho cái gì ──
 *
 * `change: "+12%"` là chuỗi viết thẳng trong mã, hiện y hệt ở mọi tháng, mọi năm, mọi đơn vị,
 * KỂ CẢ khi số liệu tải về bình thường. Nó nằm trên tờ báo cáo cán bộ mang đi họp.
 *
 * Bộ ca kiểm này ghim: đổi dữ liệu thì huy hiệu phải đổi theo — chính là thứ mà chuỗi viết
 * cứng không bao giờ làm được.
 */

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
// Khai RÕ TỪNG thành phần thay vì bọc Proxy: Proxy trả thành phần cho mọi khoá, kể cả
// `__esModule` và `Symbol.toStringTag`, và vitest treo hẳn khi hỏi những khoá ấy.
vi.mock('recharts', () => {
  const Hop = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Rong = () => null;
  return {
    ResponsiveContainer: Hop,
    BarChart: Hop,
    LineChart: Hop,
    Bar: Rong,
    Line: Rong,
    XAxis: Rong,
    YAxis: Rong,
    CartesianGrid: Rong,
    Tooltip: Rong,
    Legend: Rong,
  };
});

import { api } from '@/lib/api';
import MonthlyReportPage from '../MonthlyReportPage';

function traVe(soSanh: unknown) {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: [],
      totals: { donThu: 120, vuViec: 30, vuAn: 12, daGiaiQuyet: 80 },
      soSanh,
    },
  } as never);
}

function bao() {
  return render(
    <MemoryRouter>
      <MonthlyReportPage />
    </MemoryRouter>,
  );
}

const CHI_TIEU_TANG = {
  hienTai: 120,
  nen: 100,
  chenhLech: 20,
  tyLe: 20,
  lyDoKhongCoTyLe: null,
  doTinCay: 'DU',
  chieu: 'TANG',
  tot: null,
};

beforeEach(() => vi.clearAllMocks());

describe('Huy hiệu so sánh trên Báo cáo tháng', () => {
  it('hiện đúng con số máy chủ trả, không phải chuỗi viết sẵn', async () => {
    traVe({
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 8/2026' },
      nen: { tu: '', den: '', nhan: 'tháng 8/2025' },
      kyChuaTron: false,
      soNgayDaTroi: null,
      chiTieu: { donThu: CHI_TIEU_TANG },
    });
    bao();
    const h = await screen.findByTestId('so-sanh-donThu');
    expect(h.textContent).toContain('tăng 20%');
    // Chuỗi cũ phải biến mất hẳn khỏi màn hình.
    expect(screen.queryByText(/\+12%/)).not.toBeInTheDocument();
  });

  it('đổi dữ liệu thì huy hiệu đổi theo — điều chuỗi viết cứng không làm được', async () => {
    traVe({
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 8/2026' },
      nen: { tu: '', den: '', nhan: 'tháng 8/2025' },
      kyChuaTron: false,
      soNgayDaTroi: null,
      chiTieu: {
        donThu: { ...CHI_TIEU_TANG, hienTai: 80, nen: 100, chenhLech: -20, tyLe: -20, chieu: 'GIAM' },
      },
    });
    bao();
    const h = await screen.findByTestId('so-sanh-donThu');
    expect(h.textContent).toContain('giảm 20%');
  });

  it('máy chủ không trả khối so sánh (bản cũ) thì KHÔNG hiện huy hiệu nào', async () => {
    traVe(undefined);
    bao();
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('so-sanh-donThu')).not.toBeInTheDocument();
  });

  it('nền bằng 0 thì nói "mới phát sinh", tuyệt đối không có ký tự %', async () => {
    traVe({
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 8/2026' },
      nen: { tu: '', den: '', nhan: 'tháng 8/2025' },
      kyChuaTron: false,
      soNgayDaTroi: null,
      chiTieu: {
        donThu: {
          hienTai: 5,
          nen: 0,
          chenhLech: 5,
          tyLe: null,
          lyDoKhongCoTyLe: 'NEN_BANG_KHONG',
          doTinCay: 'KHONG_DU',
          chieu: 'TANG',
          tot: null,
        },
      },
    });
    bao();
    const h = await screen.findByTestId('so-sanh-donThu');
    expect(h.textContent).toContain('mới phát sinh 5');
    expect(h.textContent).not.toContain('%');
  });

  it('kỳ chưa trọn thì NÓI RA đang so mấy ngày đầu', async () => {
    traVe({
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 8/2026' },
      nen: { tu: '', den: '', nhan: 'tháng 8/2025 (10 ngày đầu)' },
      kyChuaTron: true,
      soNgayDaTroi: 10,
      chiTieu: { donThu: CHI_TIEU_TANG },
    });
    bao();
    const n = await screen.findByTestId('nhac-ky-chua-tron');
    expect(n.textContent).toContain('10 ngày đầu');
  });

  it('tải hỏng thì KHÔNG hiện huy hiệu lẫn câu nhắc — không nói gì về một kỳ chưa hỏi được', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    bao();
    await waitFor(() => expect(screen.getByTestId('monthly-report-load-error')).toBeInTheDocument());
    expect(screen.queryByTestId('so-sanh-donThu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nhac-ky-chua-tron')).not.toBeInTheDocument();
  });
});
