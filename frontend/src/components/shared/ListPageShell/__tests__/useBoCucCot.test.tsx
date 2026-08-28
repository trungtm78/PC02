import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBoCucCot } from '../useBoCucCot';
import { KHOA_DA_CHUYEN } from '../boCucCot';
import { userTableLayoutsApi } from '@/lib/api';
import type { ColumnDef } from '../Table';

vi.mock('@/lib/api', () => ({
  userTableLayoutsApi: {
    list: vi.fn(),
    luu: vi.fn(() => Promise.resolve({ data: {} })),
    datLai: vi.fn(() => Promise.resolve({ data: { deleted: 1 } })),
  },
}));

type Row = { id: string };
const COT: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', render: () => null },
  { key: 'stt', header: 'STT', optional: 'show', width: '7rem', render: () => null },
  { key: 'tomTat', header: 'Tóm tắt', optional: 'show', width: '20rem', render: () => null },
  { key: 'nguon', header: 'Nguồn', optional: 'hide', render: () => null },
];

function boc() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const api = userTableLayoutsApi as unknown as {
  list: ReturnType<typeof vi.fn>;
  luu: ReturnType<typeof vi.fn>;
  datLai: ReturnType<typeof vi.fn>;
};

/**
 * Giả lập phải cư xử NHƯ MÁY CHỦ: lưu xong thì lần đọc sau trả về đúng thứ vừa lưu.
 *
 * Giả lập trả rỗng mãi thì mọi phép kiểm về "thay đổi có sống sót không" đều vô nghĩa — cập
 * nhật lạc quan bị vòng tải lại xoá sạch, và ca kiểm hoặc xanh giả hoặc đỏ oan. Đây đúng lớp
 * lỗi đã bắt ở bộ dọn mã ô chọn cùng ngày: kho giả sai hợp đồng che mất lỗi thật.
 */
function ganKhoGia(banDau: Record<string, Record<string, unknown>> = {}) {
  const kho = { ...banDau };
  api.list.mockImplementation(() => Promise.resolve({ data: { ...kho } }));
  api.luu.mockImplementation((bang: string, cols: Record<string, unknown>) => {
    kho[bang] = cols;
    return Promise.resolve({ data: {} });
  });
  api.datLai.mockImplementation((bang: string) => {
    delete kho[bang];
    return Promise.resolve({ data: { deleted: 1 } });
  });
  return kho;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ganKhoGia();
});

describe('useBoCucCot', () => {
  it('chưa có bố cục thì cột y hệt mặc định trong mã', async () => {
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(['actions', 'stt', 'tomTat']);
  });

  it('bố cục từ máy chủ được áp vào cột', async () => {
    ganKhoGia({ petitions: { tomTat: { width: 480 } } });
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() =>
      expect(result.current.visibleColumns.find((c) => c.key === 'tomTat')?.width).toBe('480px'),
    );
  });

  /** Bảng khác không được lẫn vào nhau — mỗi màn một bố cục riêng. */
  it('chỉ lấy bố cục của ĐÚNG bảng ấy', async () => {
    ganKhoGia({ cases: { tomTat: { hidden: true } } });
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.visibleColumns.map((c) => c.key)).toContain('tomTat');
  });

  /**
   * Máy chủ lỗi thì bảng vẫn phải vẽ bằng mặc định trong mã. Danh sách hồ sơ không được chết
   * vì một tuỳ chọn hiển thị — đúng lớp 3 của `useUserShortcuts`.
   */
  it('máy chủ lỗi thì vẫn vẽ bằng mặc định, không vỡ trang', async () => {
    api.list.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(['actions', 'stt', 'tomTat']);
  });

  describe('đổi bố cục', () => {
    it('kéo giãn gửi bề rộng lên máy chủ', async () => {
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      act(() => result.current.datBeRong('tomTat', 480));
      await waitFor(() => expect(api.luu).toHaveBeenCalled());
      expect(api.luu.mock.calls[0][0]).toBe('petitions');
      expect(api.luu.mock.calls[0][1]).toEqual({ tomTat: { width: 480 } });
    });

    /** Đổi ô này không được xoá ô kia — người dùng ẩn cột rồi kéo giãn thì cả hai phải còn. */
    it('ghi đè mới GỘP vào bố cục đang có, không thay thế', async () => {
      ganKhoGia({ petitions: { nguon: { hidden: false } } });
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(result.current.visibleColumns.length).toBe(4));
      act(() => result.current.datBeRong('tomTat', 300));
      await waitFor(() => expect(api.luu).toHaveBeenCalled());
      expect(api.luu.mock.calls[0][1]).toEqual({
        nguon: { hidden: false },
        tomTat: { width: 300 },
      });
    });

    /**
     * Hiện NGAY khi kéo, không chờ máy chủ. Chờ mạng thì cột nhảy giật một nhịp sau mỗi lần
     * kéo và cảm giác như bị treo.
     */
    it('cột đổi ngay lập tức, không chờ máy chủ trả lời', async () => {
      let chot: (v: unknown) => void = () => {};
      api.luu.mockReturnValue(new Promise((r) => (chot = r)));
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      act(() => result.current.datBeRong('tomTat', 500));
      // Chờ React, KHÔNG chờ máy chủ: lời hứa của `luu` vẫn treo suốt phép kiểm này, nên bề
      // rộng đổi được nghĩa là giao diện không đợi mạng.
      await waitFor(() =>
        expect(result.current.visibleColumns.find((c) => c.key === 'tomTat')?.width).toBe('500px'),
      );
      expect(api.luu).toHaveBeenCalled();
      chot({ data: {} });
    });

    it('ẩn cột gửi cờ ẩn', async () => {
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      act(() => result.current.batTat('tomTat'));
      await waitFor(() => expect(api.luu).toHaveBeenCalled());
      expect(api.luu.mock.calls[0][1]).toEqual({ tomTat: { hidden: true } });
    });

    it('về mặc định gọi xoá, không gửi khối rỗng', async () => {
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      act(() => result.current.datLai());
      await waitFor(() => expect(api.datLai).toHaveBeenCalledWith('petitions'));
      expect(api.luu).not.toHaveBeenCalled();
    });
  });

  /**
   * Lựa chọn ẩn/hiện của cán bộ đang nằm trong trình duyệt. Không chuyển lên thì lần đầu mở
   * bản mới, mọi cột họ đã tắt hiện lại hết và họ phải tắt lại từ đầu trên từng máy.
   */
  describe('chuyển lựa chọn cũ trong trình duyệt lên máy chủ', () => {
    it('máy chủ chưa có gì mà trình duyệt có thì đẩy lên, một lần', async () => {
      localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false }));
      const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.luu).toHaveBeenCalled());
      expect(api.luu.mock.calls[0][1]).toEqual({ tomTat: { hidden: true } });
      expect(localStorage.getItem(KHOA_DA_CHUYEN)).toBeTruthy();
      // Lựa chọn cũ phải có hiệu lực ngay trong lần mở này, không đợi vòng tải sau — nếu
      // không, cán bộ vẫn thấy cột hiện lại đúng một lần rồi mới biến mất.
      await waitFor(() =>
        expect(result.current.visibleColumns.map((c) => c.key)).not.toContain('tomTat'),
      );
    });

    /** Máy chủ đã có bố cục thì nó thắng — không để dữ liệu cũ của một máy đè lên. */
    it('máy chủ đã có bố cục thì KHÔNG đẩy dữ liệu cũ lên', async () => {
      localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false }));
      ganKhoGia({ petitions: { stt: { width: 100 } } });
      renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 20));
      expect(api.luu).not.toHaveBeenCalled();
    });

    it('không có gì trong trình duyệt thì không gọi máy chủ', async () => {
      renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
      await waitFor(() => expect(api.list).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 20));
      expect(api.luu).not.toHaveBeenCalled();
    });
  });
});
