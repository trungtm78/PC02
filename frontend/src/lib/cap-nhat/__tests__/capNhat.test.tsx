import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, render, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { apDungBanMoi, canCapNhat, KHOA_DA_CAP_NHAT, KHOA_DA_TAI_LAI_CHUNK, taiLaiKhiHongChunk } from '../apDungBanMoi';
import { registerSW } from 'virtual:pwa-register';
import { batDauTheoDoiGo, trangDangRanh } from '../trangDangRanh';
import { coFormDoDang, useDauHieuDangSua } from '../formDoDang';
import { useTuCapNhat, TAB_AN_TOI_THIEU_MS } from '../useTuCapNhat';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn()) }));
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>;

/**
 * Anh yêu cầu 18/09/2026: thông báo "Đang dùng bản cũ" tốn thời gian và che tầm nhìn → app TỰ lên
 * bản mới, không còn hộp nhắc nào. Rủi ro thật của việc tự tải lại là cuốn mất chữ cán bộ đang gõ,
 * nên phần lớn ca kiểm dưới đây canh các thời điểm KHÔNG được tải lại.
 */
let soLanTaiLai = 0;
let diToi: string[] = [];

function datMoiTruong() {
  sessionStorage.clear();
  soLanTaiLai = 0;
  diToi = [];
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      pathname: '/petitions',
      href: 'http://localhost/petitions',
      reload: () => {
        soLanTaiLai += 1;
      },
      assign: (u: string) => {
        diToi.push(u);
      },
    },
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: vi.fn(async () => []) },
  });
  Object.defineProperty(window, 'caches', {
    configurable: true,
    value: { keys: async () => ['a'], delete: vi.fn(async () => true) },
  });
}

describe('canCapNhat — luật chống lặp theo bản đích', () => {
  beforeEach(datMoiTruong);

  it('lệch bản thì cập nhật', () => {
    expect(canCapNhat('aaa', 'bbb')).toBe(true);
  });
  it('cùng bản, thiếu bản số, hoặc máy chủ không đọc được bản thì KHÔNG', () => {
    expect(canCapNhat('aaa', 'aaa')).toBe(false);
    expect(canCapNhat('', 'bbb')).toBe(false);
    expect(canCapNhat('aaa', undefined)).toBe(false);
    expect(canCapNhat('aaa', '0.0.0.0')).toBe(false);
  });
  it('đã thử lên đúng bản đích này trong phiên thì KHÔNG thử lại (chống vòng lặp)', () => {
    sessionStorage.setItem(KHOA_DA_CAP_NHAT, 'bbb');
    expect(canCapNhat('aaa', 'bbb')).toBe(false);
  });
  /** Chốt cũ theo PHIÊN chặn luôn mọi lần deploy sau trong ngày — chốt theo bản đích thì không. */
  it('deploy sau (bản đích KHÁC) vẫn cập nhật được dù phiên đã cập nhật một lần', () => {
    sessionStorage.setItem(KHOA_DA_CAP_NHAT, 'bbb');
    expect(canCapNhat('bbb', 'ccc')).toBe(true);
  });
});

describe('trangDangRanh — chỉ tự tải khi không có gì để mất', () => {
  beforeEach(() => {
    datMoiTruong();
    document.body.innerHTML = '';
  });

  it('trang danh sách trống trải thì rảnh', () => {
    expect(trangDangRanh(document, '/petitions')).toBe(true);
  });
  it('màn nhập liệu thì KHÔNG rảnh', () => {
    expect(trangDangRanh(document, '/petitions/new')).toBe(false);
    expect(trangDangRanh(document, '/cases/abc/edit')).toBe(false);
    expect(trangDangRanh(document, '/add-new-record')).toBe(false);
  });
  it('có hộp thoại đang mở (vd hộp xoá có ô lý do) thì KHÔNG rảnh', () => {
    document.body.innerHTML = '<div role="dialog"><textarea></textarea></div>';
    expect(trangDangRanh(document, '/petitions')).toBe(false);
  });
  /**
   * Ô React ĐIỀU KHIỂN + thao tác gõ thật. Bản đầu so `value` với `defaultValue` và ca kiểm dựng ô
   * DOM thô nên xanh — nhưng React 19 đồng bộ `defaultValue` theo `value`, nên trong app thật phép
   * so luôn ra "chưa gõ" (rà mã 18/09/2026). Ca này dựng đúng thứ app dùng.
   */
  function OLyDo() {
    const [v, setV] = useState('');
    return <textarea aria-label="ly-do" value={v} onChange={(e) => setV(e.target.value)} />;
  }
  it('ô React điều khiển đã gõ chữ (hộp tự dựng không khai role) thì KHÔNG rảnh', () => {
    batDauTheoDoiGo();
    const { getByLabelText } = render(<OLyDo />);
    fireEvent.input(getByLabelText('ly-do'), { target: { value: 'Lý do xoá đang gõ' } });
    expect((getByLabelText('ly-do') as HTMLTextAreaElement).defaultValue).toBe('Lý do xoá đang gõ');
    expect(trangDangRanh(document, '/petitions')).toBe(false);
    cleanup();
  });
  it('gõ xong rồi ô bị tháo (lưu xong/đóng hộp) thì rảnh lại', () => {
    batDauTheoDoiGo();
    const { getByLabelText, unmount } = render(<OLyDo />);
    fireEvent.input(getByLabelText('ly-do'), { target: { value: 'abc' } });
    unmount();
    expect(trangDangRanh(document, '/petitions')).toBe(true);
  });
  it('xoá hết chữ đã gõ thì rảnh lại', () => {
    batDauTheoDoiGo();
    const { getByLabelText } = render(<OLyDo />);
    fireEvent.input(getByLabelText('ly-do'), { target: { value: 'abc' } });
    fireEvent.input(getByLabelText('ly-do'), { target: { value: '' } });
    expect(trangDangRanh(document, '/petitions')).toBe(true);
    cleanup();
  });
  it('lớp phủ hộp tự dựng (fixed inset-0) đang mở thì KHÔNG rảnh', () => {
    document.body.innerHTML = '<div class="fixed inset-0 bg-black/50"><div>Tạm đình chỉ</div></div>';
    expect(trangDangRanh(document, '/cases/abc')).toBe(false);
  });
  it('màn nhập liệu tên lạ được luật nhận ra (propose, backfill)', () => {
    expect(trangDangRanh(document, '/admin/deadline-rules/k1/propose')).toBe(false);
    expect(trangDangRanh(document, '/cases/tdac-backfill')).toBe(false);
  });
  it('form tự khai đang sửa dở thì KHÔNG rảnh, tháo form thì rảnh lại', () => {
    const { rerender, unmount } = renderHook(({ d }) => useDauHieuDangSua(d), { initialProps: { d: true } });
    expect(coFormDoDang()).toBe(true);
    expect(trangDangRanh(document, '/petitions')).toBe(false);
    rerender({ d: false });
    expect(coFormDoDang()).toBe(false);
    rerender({ d: true });
    unmount();
    expect(coFormDoDang()).toBe(false);
  });
});

describe('taiLaiKhiHongChunk — lỗi tải gói sau deploy', () => {
  beforeEach(datMoiTruong);

  it('tự tải lại MỘT lần cho bản đang chạy, qua đường gỡ service worker (codex 18/09/2026)', async () => {
    const goSw = navigator.serviceWorker.getRegistrations as unknown as ReturnType<typeof vi.fn>;
    expect(taiLaiKhiHongChunk('aaa')).toBe(true);
    await waitFor(() => expect(soLanTaiLai).toBe(1));
    expect(goSw).toHaveBeenCalled();
    expect(sessionStorage.getItem(KHOA_DA_TAI_LAI_CHUNK)).toBe('aaa');
  });
  it('tải lại rồi mà vẫn cùng bản (gói hỏng thật) thì KHÔNG lặp', () => {
    sessionStorage.setItem(KHOA_DA_TAI_LAI_CHUNK, 'aaa');
    expect(taiLaiKhiHongChunk('aaa')).toBe(false);
    expect(soLanTaiLai).toBe(0);
  });
});

function boc(duong: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[duong]}>{children}</MemoryRouter>;
}

describe('useTuCapNhat — ba thời điểm an toàn', () => {
  beforeEach(() => {
    datMoiTruong();
    document.body.innerHTML = '';
    apiGet.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cùng bản: không làm gì', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'aaa' } });
    renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/health'));
    await new Promise((r) => setTimeout(r, 20));
    expect(soLanTaiLai + diToi.length).toBe(0);
  });

  it('có bản mới nhưng cán bộ đang ở màn: KHÔNG tự tải ngay', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'bbb' } });
    renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(soLanTaiLai + diToi.length).toBe(0);
  });

  it('(1) chuyển màn khi có bản mới: đi tới đúng màn đích bằng bản mới', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'bbb' } });
    const { result } = renderHook(
      () => {
        useTuCapNhat('aaa');
        return useNavigate();
      },
      { wrapper: boc('/petitions') },
    );
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    act(() => result.current('/cases', { state: { activeTab: 'tai-lieu' } }));
    // `reload()` chứ không `assign(url)`: giữ `history.state` của màn đích (rà mã 18/09/2026).
    await waitFor(() => expect(soLanTaiLai).toBe(1));
    expect(diToi).toEqual([]);
    expect(sessionStorage.getItem(KHOA_DA_CAP_NHAT)).toBe('bbb');
  });

  it('(2) quay lại tab sau lâu, trang rảnh: tự tải lại', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'bbb' } });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    now.mockReturnValue(1_000_000 + TAB_AN_TOI_THIEU_MS + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(soLanTaiLai).toBe(1));
    now.mockRestore();
  });

  it('(2) quay lại tab nhưng đang gõ lý do trong hộp thoại: KHÔNG tải lại', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'bbb' } });
    document.body.innerHTML = '<div role="dialog"><textarea></textarea></div>';
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    now.mockReturnValue(1_000_000 + TAB_AN_TOI_THIEU_MS + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(soLanTaiLai).toBe(0);
    now.mockRestore();
  });

  it('(2) ẩn tab chỉ chốc lát: KHÔNG tải lại', async () => {
    apiGet.mockResolvedValue({ data: { buildId: 'bbb' } });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    now.mockReturnValue(1_000_000 + 1000);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(soLanTaiLai).toBe(0);
    now.mockRestore();
  });

  it('máy chủ lỗi: im lặng, không tải lại khi chuyển màn', async () => {
    apiGet.mockRejectedValue(new Error('mat mang'));
    const { result } = renderHook(
      () => {
        useTuCapNhat('aaa');
        return useNavigate();
      },
      { wrapper: boc('/petitions') },
    );
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    act(() => result.current('/cases'));
    await new Promise((r) => setTimeout(r, 20));
    expect(soLanTaiLai + diToi.length).toBe(0);
  });
});

describe('nhánh biên', () => {
  beforeEach(() => {
    datMoiTruong();
    document.body.innerHTML = '';
    apiGet.mockReset();
  });

  it('kho phiên bị chặn (chế độ riêng tư): KHÔNG tự cập nhật, KHÔNG tự tải lại vì gói', () => {
    const goc = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError');
    };
    try {
      expect(canCapNhat('aaa', 'bbb')).toBe(false);
      expect(taiLaiKhiHongChunk('aaa')).toBe(false);
      expect(soLanTaiLai).toBe(0);
    } finally {
      Storage.prototype.getItem = goc;
    }
  });

  it('không ghi được chốt thì KHÔNG tải lại (tránh lặp không chốt)', async () => {
    const goc = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    try {
      await apDungBanMoi('bbb');
      expect(soLanTaiLai).toBe(0);
    } finally {
      Storage.prototype.setItem = goc;
    }
  });

  it('gỡ service worker lỗi vẫn tải trang (lượt tải tự lấy bản mới)', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: vi.fn(async () => { throw new Error('hong'); }) },
    });
    const canhBao = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await apDungBanMoi('bbb');
    expect(soLanTaiLai).toBe(1);
    canhBao.mockRestore();
  });

  it('ô contenteditable đã gõ chữ thì KHÔNG rảnh', () => {
    batDauTheoDoiGo();
    document.body.innerHTML = '<div contenteditable="true">ghi chú đang gõ</div>';
    fireEvent.input(document.querySelector('[contenteditable]') as Element);
    expect(trangDangRanh(document, '/petitions')).toBe(false);
    document.body.innerHTML = '';
  });

  it('service worker báo có bản chờ → hỏi lại máy chủ; đăng ký xong thì hẹn nhịp tự kiểm', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiGet.mockResolvedValue({ data: { buildId: 'aaa' } });
    const dangKy = { update: vi.fn(async () => undefined) };
    const reg = registerSW as unknown as ReturnType<typeof vi.fn>;
    reg.mockClear();
    const { unmount } = renderHook(() => useTuCapNhat('aaa'), { wrapper: boc('/petitions') });
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    const tuyChon = reg.mock.calls[0][0] as {
      onNeedRefresh: () => void;
      onRegisteredSW: (u: string, r?: { update: () => Promise<unknown> }) => void;
    };
    tuyChon.onNeedRefresh();
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    tuyChon.onRegisteredSW('/sw-v2.js', undefined);
    tuyChon.onRegisteredSW('/sw-v2.js', dangKy);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(dangKy.update).toHaveBeenCalledTimes(1);
    unmount();
  });
});
