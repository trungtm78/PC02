import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Ô chọn kỳ phải thật sự CHỌN kỳ.
 *
 * ── Đo được gì trong mã ──
 *
 * Ô chọn tháng viết cứng sáu lựa chọn của riêng năm 2026 (`"2026-01"` … `"2026-06"`), và KHÔNG
 * theo ô chọn năm bên cạnh. Hệ quả đo được ngay trên mã:
 *
 *   1. Chọn năm 2025 → tiêu đề vẫn ghi "tháng 02/2026", và **Xuất Excel xuất tháng 2 năm 2026**.
 *      Cán bộ nhận về một tệp không phải kỳ mình vừa chọn, tên tệp cũng ghi 2026 nên không có
 *      chỗ nào lộ ra sự lệch.
 *   2. Không có tháng 7–12: nửa cuối năm không xuất được.
 *   3. Bốn thẻ số và bảng bên dưới luôn là CẢ NĂM, trong khi tiêu đề ngay trên chúng ghi tên
 *      một tháng.
 *
 * Điểm (3) nằm im nhiều tháng vì bốn thẻ không có gì nói chúng thuộc kỳ nào. Huy hiệu so sánh
 * làm nó lộ ra: huy hiệu nói "so với năm 2025" trong khi tiêu đề nói "tháng 02".
 *
 * ── Luật ──
 *
 * Một ô chọn kỳ phải điều khiển MỌI thứ mang tên kỳ ấy trên màn: số liệu, huy hiệu, bảng, và
 * tệp xuất ra. Và danh sách kỳ phải sinh ra từ năm đang chọn, không viết cứng.
 */

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
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
    PieChart: Hop,
    Pie: Rong,
    Cell: Rong,
    AreaChart: Hop,
    Area: Rong,
  };
});

import { api } from '@/lib/api';
import MonthlyReportPage from '../MonthlyReportPage';
import QuarterlyReportPage from '../QuarterlyReportPage';

const PHAN_HOI = {
  data: {
    success: true,
    data: [],
    totals: { donThu: 1, vuViec: 1, vuAn: 1, daGiaiQuyet: 1 },
    soSanh: {
      kieu: 'CUNG_KY_NAM_TRUOC',
      ky: { tu: '', den: '', nhan: 'tháng 3/2025' },
      nen: { tu: '', den: '', nhan: 'tháng 3/2024' },
      kyChuaTron: false,
      soNgayDaTroi: null,
      chiTieu: {},
    },
  },
};

function bao(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** Tham số của lần gọi gần nhất tới một endpoint. */
function lanGoi(duong: string) {
  const c = vi.mocked(api.get).mock.calls.filter((x) => String(x[0]).includes(duong));
  return c.length ? (c[c.length - 1][1] as { params?: Record<string, unknown> })?.params : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(PHAN_HOI as never);
});

describe('Báo cáo tháng — ô chọn kỳ điều khiển báo cáo', () => {
  it('danh sách kỳ sinh từ NĂM đang chọn: 12 tháng + 12 mốc lũy kế + cả năm + tự chọn', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nam'), { target: { value: '2025' } });
    const o = screen.getByTestId('chon-ky') as HTMLSelectElement;
    const nhan = [...o.options].map((x) => x.textContent);
    expect(nhan).toContain('Cả năm 2025');
    expect(nhan).toContain('Tháng 12/2025');
    expect(nhan).toContain('Lũy kế 8 tháng đầu năm 2025');
    expect(nhan).toContain('Khoảng tự chọn…');
    expect(nhan.some((n) => n?.includes('2026'))).toBe(false);
  });

  it('đổi NĂM thì kỳ xuất Excel đi theo — không xuất nhầm năm khác', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nam'), { target: { value: '2025' } });
    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'THANG:3' } });
    fireEvent.click(screen.getByTestId('xuat-excel'));

    await waitFor(() => expect(lanGoi('/reports/monthly/export')).toBeDefined());
    expect(lanGoi('/reports/monthly/export')).toEqual({ year: 2025, month: 3 });
  });

  it('chọn một tháng thì SỐ LIỆU hỏi đúng tháng ấy, không hỏi cả năm', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'THANG:3' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.month).toBe(3));
  });

  it('chọn "Cả năm" thì KHÔNG gửi tháng nào', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'THANG:3' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.month).toBe(3));

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'NAM' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.month).toBeUndefined());
  });

  /** Bốn kiểu chọn kỳ anh yêu cầu, đo tận tham số gửi đi. */
  it('LŨY KẾ gửi luyKeDenThang, không gửi month', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'LUY_KE:8' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.luyKeDenThang).toBe(8));
    expect(lanGoi('/reports/monthly')?.month).toBeUndefined();
  });

  it('KHOẢNG TỰ CHỌN chỉ gửi khi đủ HAI đầu — nửa khoảng là một kỳ khác hẳn', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'TUY_CHON' } });
    fireEvent.change(screen.getByTestId('ky-tu'), { target: { value: '2026-03-01' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')).toBeDefined());
    expect(lanGoi('/reports/monthly')?.tu).toBeUndefined();

    fireEvent.change(screen.getByTestId('ky-den'), { target: { value: '2026-05-31' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.tu).toBe('2026-03-01'));
    expect(lanGoi('/reports/monthly')?.den).toBe('2026-05-31');
  });

  /**
   * Codex bắt: bấm Xuất khi khoảng tự chọn mới có MỘT đầu thì máy chủ trả CẢ NĂM, trong khi tên
   * tệp vẫn mang dáng khoảng tự chọn với một đầu trống. Người nhận tệp cầm một năm số liệu dưới
   * một cái tên nói khác.
   */
  it('khoảng tự chọn thiếu một đầu → KHOÁ nút Xuất, không xuất nhầm cả năm', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'TUY_CHON' } });
    expect(screen.getByTestId('xuat-excel')).toBeDisabled();

    fireEvent.change(screen.getByTestId('ky-tu'), { target: { value: '2026-03-01' } });
    expect(screen.getByTestId('xuat-excel')).toBeDisabled();

    fireEvent.change(screen.getByTestId('ky-den'), { target: { value: '2026-05-31' } });
    expect(screen.getByTestId('xuat-excel')).not.toBeDisabled();
  });

  it('kỳ thường thì nút Xuất luôn mở', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('xuat-excel')).not.toBeDisabled();

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'LUY_KE:8' } });
    expect(screen.getByTestId('xuat-excel')).not.toBeDisabled();
  });

  /**
   * Tự soát bắt, sau khi Codex đã chỉ chỗ tương tự ở nút Xuất: khoảng tự chọn thiếu một đầu thì
   * `thamSoKy` trả `{}`, nên máy chủ hiểu là CẢ NĂM và màn hình hiện số cả năm dưới ô đang ghi
   * "khoảng tự chọn". Đúng lớp lỗi "màn nói một kỳ, số là kỳ khác".
   *
   * Không hỏi máy chủ là câu trả lời đúng: chưa đủ thông tin thì chưa có gì để hiện.
   */
  it('khoảng tự chọn thiếu một đầu → KHÔNG hỏi máy chủ, và nói rõ còn thiếu gì', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    const truoc = vi.mocked(api.get).mock.calls.length;

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'TUY_CHON' } });
    fireEvent.change(screen.getByTestId('ky-tu'), { target: { value: '2026-03-01' } });

    expect(await screen.findByTestId('thieu-ngay-khoang')).toBeInTheDocument();
    expect(vi.mocked(api.get).mock.calls.length).toBe(truoc);

    fireEvent.change(screen.getByTestId('ky-den'), { target: { value: '2026-05-31' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.tu).toBe('2026-03-01'));
    expect(screen.queryByTestId('thieu-ngay-khoang')).not.toBeInTheDocument();
  });

  it('nền so sánh mặc định là CÙNG KỲ NĂM TRƯỚC, theo quy ước báo cáo ngành', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(lanGoi('/reports/monthly')?.soSanh).toBe('CUNG_KY_NAM_TRUOC'));
  });

  /**
   * Codex bắt: vừa chọn "khoảng tự chọn" mà chưa nhập đủ hai đầu thì gửi `soSanh=TUY_CHON` là
   * bắt máy chủ ném lỗi — màn hình nháy sang trạng thái hỏng trong lúc người ta còn đang gõ.
   */
  it('chọn nền tự chọn mà CHƯA nhập đủ hai đầu → tạm KHÔNG SO, không gọi lỗi', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nen'), { target: { value: 'TUY_CHON' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.soSanh).toBe('KHONG'));

    fireEvent.change(screen.getByTestId('nen-tu'), { target: { value: '2024-01-01' } });
    await waitFor(() => expect(lanGoi('/reports/monthly')?.soSanh).toBe('KHONG'));
  });

  it('đổi nền sang KHOẢNG TỰ CHỌN thì gửi hai đầu nền', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nen'), { target: { value: 'TUY_CHON' } });
    fireEvent.change(screen.getByTestId('nen-tu'), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByTestId('nen-den'), { target: { value: '2024-06-30' } });

    await waitFor(() => expect(lanGoi('/reports/monthly')?.nenTu).toBe('2024-01-01'));
    expect(lanGoi('/reports/monthly')?.nenDen).toBe('2024-06-30');
    expect(lanGoi('/reports/monthly')?.soSanh).toBe('TUY_CHON');
  });

  it('ô nhập khoảng chỉ hiện khi CHỌN khoảng tự chọn — không làm rối màn', async () => {
    bao(<MonthlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('khoang-ky')).not.toBeInTheDocument();
    expect(screen.queryByTestId('khoang-nen')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'TUY_CHON' } });
    expect(screen.getByTestId('khoang-ky')).toBeInTheDocument();
  });

  it('tiêu đề phần chi tiết nói ĐÚNG kỳ máy chủ đã trả, không tự đặt', async () => {
    bao(<MonthlyReportPage />);
    const t = await screen.findByTestId('tieu-de-ky');
    expect(t.textContent).toContain('tháng 3/2025');
  });
});

describe('Báo cáo quý — ô chọn kỳ điều khiển báo cáo', () => {
  it('danh sách kỳ sinh từ NĂM đang chọn, đủ 4 quý + lũy kế', async () => {
    bao(<QuarterlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nam'), { target: { value: '2024' } });
    const o = screen.getByTestId('chon-ky') as HTMLSelectElement;
    const nhan = [...o.options].map((x) => x.textContent);
    expect(nhan).toContain('Quý IV/2024');
    expect(nhan).toContain('Cả năm 2024');
    expect(nhan).toContain('Lũy kế 6 tháng đầu năm 2024');
    expect(nhan.some((n) => n?.includes('2026'))).toBe(false);
  });

  it('đổi NĂM thì kỳ xuất Excel đi theo', async () => {
    bao(<QuarterlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-nam'), { target: { value: '2024' } });
    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'QUY:2' } });
    fireEvent.click(screen.getByTestId('xuat-excel'));

    await waitFor(() => expect(lanGoi('/reports/quarterly/export')).toBeDefined());
    expect(lanGoi('/reports/quarterly/export')).toEqual({ year: 2024, quarter: 2 });
  });

  it('chọn một quý thì số liệu hỏi đúng quý ấy', async () => {
    bao(<QuarterlyReportPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('chon-ky'), { target: { value: 'QUY:2' } });
    await waitFor(() => expect(lanGoi('/reports/quarterly')?.quarter).toBe(2));
  });
});
