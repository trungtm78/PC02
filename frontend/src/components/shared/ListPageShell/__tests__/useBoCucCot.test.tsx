import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBoCucCot } from '../useBoCucCot';
import { khoaDaChuyen } from '../boCucCot';
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
      await waitFor(() => expect(localStorage.getItem(khoaDaChuyen('petitions'))).toBeTruthy());
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

/**
 * CỔNG (Codex 28/08/2026): bốn lỗi bộ ca kiểm cũ để lọt.
 *
 * Ca kiểm cũ chỉ chuyển MỘT bảng và luôn giả định máy chủ nhận thành công, nên cả hai lỗi
 * dưới đây đều xanh: khoá "đã chuyển" dùng chung cho mọi bảng, và cờ đặt trước khi lưu xong.
 */
describe('useBoCucCot — lỗi Codex bắt được', () => {
  it('chuyển được NHIỀU bảng trên cùng một trình duyệt', async () => {
    localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false }));
    localStorage.setItem('cases_columns', JSON.stringify({ nguon: false }));
    ganKhoGia();

    const { unmount } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.luu).toHaveBeenCalledWith('petitions', expect.anything()));
    unmount();

    // Khoá "đã chuyển" dùng chung thì màn thứ hai KHÔNG BAO GIỜ được chuyển, và lựa chọn cũ
    // của nó mất hẳn. Dữ liệu cũ vốn nằm theo TỪNG bảng (`cases_columns`, `petitions_columns`).
    renderHook(() => useBoCucCot('cases', COT), { wrapper: boc() });
    await waitFor(() => expect(api.luu).toHaveBeenCalledWith('cases', expect.anything()));
  });

  it('máy chủ lưu HỎNG thì KHÔNG đánh dấu đã chuyển — lần sau còn thử lại', async () => {
    localStorage.setItem('petitions_columns', JSON.stringify({ tomTat: false }));
    api.list.mockResolvedValue({ data: {} });
    api.luu.mockRejectedValue(new Error('500'));

    renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.luu).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    // Đặt cờ trước khi lưu xong thì lựa chọn cũ của cán bộ mất hẳn, không lần nào thử lại.
    expect(localStorage.getItem(khoaDaChuyen('petitions'))).toBeNull();
  });

  /** Menu lấy thứ tự khai trong mã thì sau một lần dời, nút dời kế tiếp trỏ sai chỗ. */
  it('danh sách cho menu theo THỨ TỰ HIỆN HÀNH, không phải thứ tự khai trong mã', async () => {
    ganKhoGia({ petitions: { tomTat: { position: 0 } } });
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(result.current.toggleableColumns[0]?.key).toBe('tomTat'));
  });

  /** Menu hiện cả cột đang ẩn (để bật lại) — bỏ chúng đi là bỏ mất việc chính của menu. */
  it('danh sách cho menu GIỮ cả cột đang ẩn', async () => {
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.toggleableColumns.map((c) => c.key)).toContain('nguon');
    expect(result.current.visibleColumns.map((c) => c.key)).not.toContain('nguon');
  });

  /** Nút dời của cột đang ẩn vẫn hiện trong menu, nên dời nó phải có tác dụng thật. */
  it('dời được cả cột đang ẩn', async () => {
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    act(() => result.current.doiCho('nguon', 0));
    await waitFor(() => expect(api.luu).toHaveBeenCalled());
    expect(api.luu.mock.calls[0][1]).toMatchObject({ nguon: { position: 0 } });
  });

  it('chưa ai kéo thì báo KHÔNG có ghi đè bề rộng', async () => {
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.coGhiDeBeRong).toBe(false);
  });

  it('đã kéo một cột thì báo CÓ ghi đè bề rộng', async () => {
    ganKhoGia({ petitions: { tomTat: { width: 400 } } });
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(result.current.coGhiDeBeRong).toBe(true));
  });

  /** Ẩn cột KHÔNG phải kéo giãn — không được làm bảng đổi sang cuộn ngang. */
  it('chỉ ẩn cột thôi thì vẫn báo KHÔNG có ghi đè bề rộng', async () => {
    ganKhoGia({ petitions: { tomTat: { hidden: true } } });
    const { result } = renderHook(() => useBoCucCot('petitions', COT), { wrapper: boc() });
    await waitFor(() => expect(api.list).toHaveBeenCalled());
    expect(result.current.coGhiDeBeRong).toBe(false);
  });
});
