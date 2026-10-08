/**
 * Chia sẻ phiên giữa các tab (lib/chiaSePhien.ts). Ca kiểm đơn vị dùng kênh giả trong bộ nhớ; hành vi THẬT của
 * `sessionStorage` + `noopener` + BroadcastChannel trên Chromium/WebKit do cổng engine canh
 * (`tests/engine/chia-se-phien.engine.spec.ts`) — jsdom không mô phỏng được tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  batDauTraLoiPhien,
  coTheCoPhienOTabKhac,
  datKenhChoCaKiem,
  xinPhienTuTabKhac,
} from '../chiaSePhien';
import { authStore } from '@/stores/auth.store';

type NguoiNhan = { onmessage: ((e: { data: unknown }) => void) | null };

/** Bus giả: mọi kênh cùng tên nhận tin của kênh khác (không nhận tin của chính nó), giống BroadcastChannel thật. */
function dungBus() {
  const kenhs = new Set<NguoiNhan & { closed: boolean }>();
  const taoKenh = () => {
    const k: NguoiNhan & { closed: boolean; postMessage(m: unknown): void; close(): void } = {
      onmessage: null,
      closed: false,
      postMessage(m) {
        queueMicrotask(() =>
          kenhs.forEach((o) => {
            if (o !== k && !o.closed) o.onmessage?.({ data: m });
          }),
        );
      },
      close() {
        k.closed = true;
        kenhs.delete(k);
      },
    };
    kenhs.add(k);
    return k;
  };
  return { taoKenh, soKenh: () => kenhs.size };
}

function jwt(exp: number | undefined, sub = 'u1'): string {
  const b = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b({ alg: 'HS256' })}.${b({ sub, ...(exp === undefined ? {} : { exp }) })}.chu-ky`;
}
const CON_HAN = () => Math.floor(Date.now() / 1000) + 3600;
const HET_HAN = () => Math.floor(Date.now() / 1000) - 60;

describe('chiaSePhien', () => {
  let khoiPhuc: () => void;
  let bus: ReturnType<typeof dungBus>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    bus = dungBus();
    khoiPhuc = datKenhChoCaKiem(bus.taoKenh);
  });
  afterEach(() => {
    khoiPhuc();
    vi.useRealTimers();
  });

  /** Mô phỏng tab khác: trả lời bằng token cho trước. Dùng chung bus nên tab hỏi cũng "thấy" nó. */
  function tabKhacDangNhap(token: string) {
    const kenh = bus.taoKenh();
    kenh.onmessage = (e) => {
      const g = e.data as { loai: string; id: string };
      if (g.loai === 'hoi') kenh.postMessage({ loai: 'dap', id: g.id, accessToken: token });
    };
  }

  it('đã có token ở tab này → true ngay, không hỏi ai', async () => {
    sessionStorage.setItem('accessToken', jwt(CON_HAN()));
    const lanTruoc = bus.soKenh();
    expect(await xinPhienTuTabKhac()).toBe(true);
    expect(bus.soKenh()).toBe(lanTruoc);
  });

  it('TAB MỚI + tab khác đang đăng nhập → nhận token, ghi vào sessionStorage CỦA TAB NÀY', async () => {
    const token = jwt(CON_HAN());
    tabKhacDangNhap(token);
    expect(authStore.getAccessToken()).toBeNull();
    expect(await xinPhienTuTabKhac()).toBe(true);
    expect(authStore.getAccessToken()).toBe(token);
    expect(authStore.isAuthenticated()).toBe(true);
  });

  it('nhận phiên báo cho nơi lắng nghe đổi token (useAuthHydration nạp hồ sơ)', async () => {
    tabKhacDangNhap(jwt(CON_HAN()));
    const baoDoi = vi.fn();
    const huy = authStore.onTokenChanged(baoDoi);
    await xinPhienTuTabKhac();
    huy();
    expect(baoDoi).toHaveBeenCalled();
  });

  it('KHÔNG đụng refresh token ở localStorage', async () => {
    localStorage.setItem('refreshToken', 'rt-cu');
    tabKhacDangNhap(jwt(CON_HAN()));
    await xinPhienTuTabKhac();
    expect(localStorage.getItem('refreshToken')).toBe('rt-cu');
  });

  it('không tab nào trả lời → false sau thời hạn, KHÔNG ghi token', async () => {
    vi.useFakeTimers();
    const p = xinPhienTuTabKhac(500);
    await vi.advanceTimersByTimeAsync(499);
    expect(authStore.getAccessToken()).toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    expect(await p).toBe(false);
    expect(authStore.getAccessToken()).toBeNull();
  });

  it('xong (dù thành công hay quá hạn) đều ĐÓNG kênh — không rò bộ lắng nghe', async () => {
    tabKhacDangNhap(jwt(CON_HAN()));
    const truoc = bus.soKenh();
    await xinPhienTuTabKhac();
    expect(bus.soKenh()).toBe(truoc);
    sessionStorage.clear();
    vi.useFakeTimers();
    const p = xinPhienTuTabKhac(100);
    await vi.advanceTimersByTimeAsync(150);
    await p;
    expect(bus.soKenh()).toBe(truoc);
  });

  describe('từ chối thứ không phải phiên hợp lệ', () => {
    const THU = [
      ['token hết hạn', () => jwt(HET_HAN())],
      ['không phải JWT', () => 'khong-phai-jwt'],
      ['hai phần', () => 'a.b'],
      ['phần giữa không giải mã được', () => 'a.%%%.c'],
      ['rỗng', () => ''],
    ] as const;
    for (const [ten, tao] of THU) {
      it(`${ten} → không nhận`, async () => {
        vi.useFakeTimers();
        tabKhacDangNhap(tao());
        const p = xinPhienTuTabKhac(200);
        await vi.advanceTimersByTimeAsync(300);
        expect(await p).toBe(false);
        expect(authStore.getAccessToken()).toBeNull();
      });
    }

    it('trả lời cho yêu cầu KHÁC (id lạ) → bỏ qua', async () => {
      vi.useFakeTimers();
      const kenh = bus.taoKenh();
      kenh.onmessage = () => kenh.postMessage({ loai: 'dap', id: 'id-khac', accessToken: jwt(CON_HAN()) });
      const p = xinPhienTuTabKhac(200);
      await vi.advanceTimersByTimeAsync(300);
      expect(await p).toBe(false);
    });

    it('token không có exp vẫn nhận (JWT của máy chủ luôn có exp, nhưng thiếu không phải lý do từ chối)', async () => {
      tabKhacDangNhap(jwt(undefined));
      expect(await xinPhienTuTabKhac()).toBe(true);
    });
  });

  describe('batDauTraLoiPhien — phía tab đang đăng nhập', () => {
    it('đang đăng nhập → trả lời đúng token của mình, kèm id của yêu cầu', async () => {
      const token = jwt(CON_HAN());
      sessionStorage.setItem('accessToken', token);
      const huy = batDauTraLoiPhien();
      const nhan = vi.fn();
      const hoi = bus.taoKenh();
      hoi.onmessage = (e) => nhan(e.data);
      hoi.postMessage({ loai: 'hoi', id: 'abc' });
      await Promise.resolve();
      await Promise.resolve();
      expect(nhan).toHaveBeenCalledWith({ loai: 'dap', id: 'abc', accessToken: token });
      huy();
    });

    it('CHƯA đăng nhập → im lặng', async () => {
      const huy = batDauTraLoiPhien();
      const nhan = vi.fn();
      const hoi = bus.taoKenh();
      hoi.onmessage = (e) => nhan(e.data);
      hoi.postMessage({ loai: 'hoi', id: 'abc' });
      await Promise.resolve();
      await Promise.resolve();
      expect(nhan).not.toHaveBeenCalled();
      huy();
    });

    it('token của chính nó đã hết hạn → không chia sẻ', async () => {
      sessionStorage.setItem('accessToken', jwt(HET_HAN()));
      const huy = batDauTraLoiPhien();
      const nhan = vi.fn();
      const hoi = bus.taoKenh();
      hoi.onmessage = (e) => nhan(e.data);
      hoi.postMessage({ loai: 'hoi', id: 'abc' });
      await Promise.resolve();
      await Promise.resolve();
      expect(nhan).not.toHaveBeenCalled();
      huy();
    });

    it('bỏ qua tin rác / tin không phải "hỏi" (không ném lỗi, không trả lời)', async () => {
      sessionStorage.setItem('accessToken', jwt(CON_HAN()));
      const huy = batDauTraLoiPhien();
      const nhan = vi.fn();
      const hoi = bus.taoKenh();
      hoi.onmessage = (e) => nhan(e.data);
      for (const rac of [null, 'x', 5, {}, { loai: 'dap', id: 'a' }, { loai: 'hoi' }, { loai: 'hoi', id: 7 }]) {
        hoi.postMessage(rac);
      }
      await Promise.resolve();
      await Promise.resolve();
      expect(nhan).not.toHaveBeenCalled();
      huy();
    });

    it('gỡ đăng ký → đóng kênh', () => {
      const huy = batDauTraLoiPhien();
      expect(bus.soKenh()).toBe(1);
      huy();
      expect(bus.soKenh()).toBe(0);
    });
  });

  describe('môi trường không có BroadcastChannel', () => {
    it('xin phiên → false ngay, trả lời → không làm gì (không ném lỗi)', async () => {
      const kp = datKenhChoCaKiem(() => null);
      expect(await xinPhienTuTabKhac()).toBe(false);
      expect(() => batDauTraLoiPhien()()).not.toThrow();
      kp();
    });
  });

  describe('coTheCoPhienOTabKhac', () => {
    it('có refresh token ở localStorage → đáng chờ', () => {
      localStorage.setItem('refreshToken', 'rt');
      expect(coTheCoPhienOTabKhac()).toBe(true);
    });
    it('không có (chưa đăng nhập hoặc đã đăng xuất) → không chờ', () => {
      expect(coTheCoPhienOTabKhac()).toBe(false);
    });
  });
});
