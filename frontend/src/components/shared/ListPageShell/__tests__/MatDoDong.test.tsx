import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ListPageShell } from '../ListPageShell';
import { Table, type ColumnDef } from '../Table';
import { SummaryCell } from '../SummaryCell';
import { ChonMatDo } from '../ChonMatDo';
import { MatDoContext } from '../matDo';
import { useMatDoDong } from '../useMatDoDong';
import { matDoDongApi } from '@/lib/api';

/**
 * Mật độ dòng (18/09/2026, PR-F2 — mẫu Airtable "row height"): Gọn (mỗi ô 1 dòng) / Đọc (Tóm tắt 5 dòng,
 * MẶC ĐỊNH theo yêu cầu anh) / Đầy đủ (không kẹp). Khi hầu hết hồ sơ đều dài, bấm "Xem thêm" từng dòng là việc
 * vặt — chọn "Đầy đủ" một lần. Nhớ theo cán bộ ở máy chủ.
 */
vi.mock('@/lib/api', () => ({
  matDoDongApi: { list: vi.fn(), luu: vi.fn() },
}));
const apiList = matDoDongApi.list as unknown as ReturnType<typeof vi.fn>;
const apiLuu = matDoDongApi.luu as unknown as ReturnType<typeof vi.fn>;

const DAI = 'Tố giác '.repeat(60);
function giaLapTran() {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
}
afterEach(() => {
  vi.restoreAllMocks();
  apiList.mockReset();
  apiLuu.mockReset();
});

describe('SummaryCell theo mật độ', () => {
  it('Gọn → kẹp 1 dòng; Đọc (mặc định, không có context) → 5 dòng', () => {
    giaLapTran();
    const { unmount } = render(
      <MatDoContext.Provider value="gon">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-1\b/);
    unmount();
    render(<SummaryCell value={DAI} />);
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-5\b/);
  });

  it('Gọn → THẬT SỰ một dòng: không nút "Xem thêm" (nút chiếm dòng thứ hai), rê chuột đọc toàn văn', () => {
    giaLapTran();
    render(
      <MatDoContext.Provider value="gon">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-text')).toHaveAttribute('title', DAI.trim());
  });

  it('đang bung ở "Đọc" rồi đổi mật độ → ô theo mật độ mới, không kẹt ở trạng thái bung', () => {
    giaLapTran();
    const { rerender } = render(
      <MatDoContext.Provider value="doc">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /xem thêm/i }));
    expect(screen.getByTestId('summary-text').className).not.toMatch(/line-clamp/);
    rerender(
      <MatDoContext.Provider value="gon">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-1\b/);
    rerender(
      <MatDoContext.Provider value="doc">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-5\b/);
  });

  it('Đầy đủ → không kẹp, KHÔNG có nút "Xem thêm" dù chữ dài', () => {
    giaLapTran();
    render(
      <MatDoContext.Provider value="day-du">
        <SummaryCell value={DAI} />
      </MatDoContext.Provider>,
    );
    expect(screen.getByTestId('summary-text').className).not.toMatch(/line-clamp/);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('<Table matDo>', () => {
  type Row = { id: string };
  const COT: ColumnDef<Row>[] = [
    { key: 'tomTat', header: 'Tóm tắt', width: '20rem', render: () => <SummaryCell value={DAI} /> },
    { key: 'nguon', header: 'Nguồn', width: '8rem', render: () => 'Công an phường' },
  ];
  const ve = (matDo?: 'gon' | 'doc' | 'day-du') =>
    render(
      <ListPageShell>
        <Table state="ready" columns={COT} data={[{ id: 'r1' }]} rowKey={(r: Row) => r.id} fixedLayout xuongDong matDo={matDo} />
      </ListPageShell>,
    );

  it('Gọn → ô dữ liệu một dòng (cắt bằng dấu …), Tóm tắt 1 dòng', () => {
    giaLapTran();
    ve('gon');
    expect(screen.getByText('Công an phường').closest('td')!.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-1\b/);
  });

  it('Đọc / Đầy đủ → ô xuống dòng', () => {
    ve('day-du');
    expect(screen.getByText('Công an phường').closest('td')!.className).toMatch(/\bwhitespace-normal\b/);
  });
});

describe('ChonMatDo', () => {
  it('ba lựa chọn, đánh dấu lựa chọn đang dùng, bấm là đổi', () => {
    const doi = vi.fn();
    render(<ChonMatDo giaTri="doc" onDoi={doi} />);
    const nhom = screen.getByRole('group', { name: /mật độ dòng/i });
    expect(nhom).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đọc/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Gọn/ })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Đầy đủ/ }));
    expect(doi).toHaveBeenCalledWith('day-du');
  });
});

describe('useMatDoDong', () => {
  function khung() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Boc = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return Boc;
  }

  it('chưa chọn → "Đọc"; đã chọn trên máy chủ → dùng lựa chọn ấy', async () => {
    apiList.mockResolvedValue({ data: { petitions: 'gon' } });
    const { result } = renderHook(() => useMatDoDong('cases'), { wrapper: khung() });
    expect(result.current[0]).toBe('doc');
    const { result: r2 } = renderHook(() => useMatDoDong('petitions'), { wrapper: khung() });
    await waitFor(() => expect(r2.current[0]).toBe('gon'));
  });

  /**
   * Bố cục cột (`useBoCucCot`) huỷ/làm mới khoá `['user-table-layouts']` theo TIỀN TỐ — khoá mật độ nằm dưới tiền
   * tố ấy thì mỗi lần kéo cột lại huỷ truy vấn mật độ, bảng lật tạm về "Đọc" (rà mã PR-F2).
   */
  it('làm mới bố cục cột KHÔNG đụng mật độ (khoá riêng, không chung tiền tố)', async () => {
    apiList.mockResolvedValue({ data: { petitions: 'gon' } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Boc = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMatDoDong('petitions'), { wrapper: Boc });
    await waitFor(() => expect(result.current[0]).toBe('gon'));
    await act(async () => {
      await qc.cancelQueries({ queryKey: ['user-table-layouts'] });
      await qc.invalidateQueries({ queryKey: ['user-table-layouts'] });
    });
    expect(apiList).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe('gon');
  });

  it('máy chủ lỗi → vẫn "Đọc" (danh sách không chết vì một tuỳ chọn hiển thị)', async () => {
    apiList.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useMatDoDong('petitions'), { wrapper: khung() });
    await waitFor(() => expect(apiList).toHaveBeenCalled());
    expect(result.current[0]).toBe('doc');
  });

  it('đổi → hiện NGAY (không chờ mạng) và lưu lên máy chủ; lưu hỏng → trả lại lựa chọn cũ', async () => {
    apiList.mockResolvedValue({ data: { petitions: 'doc' } });
    let tuChoi: (e: Error) => void = () => {};
    apiLuu.mockReturnValue(new Promise((_r, rej) => (tuChoi = rej)));
    const { result } = renderHook(() => useMatDoDong('petitions'), { wrapper: khung() });
    await waitFor(() => expect(apiList).toHaveBeenCalled());
    act(() => result.current[1]('day-du'));
    await waitFor(() => expect(result.current[0]).toBe('day-du'));
    expect(apiLuu).toHaveBeenCalledWith('petitions', 'day-du');
    apiList.mockResolvedValue({ data: { petitions: 'doc' } });
    await act(async () => tuChoi(new Error('mất mạng')));
    await waitFor(() => expect(result.current[0]).toBe('doc'));
  });
});
