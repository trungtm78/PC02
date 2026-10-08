import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import { buildSync } from 'esbuild';

/**
 * CỔNG ENGINE: tab mới mở có nhận được phiên đăng nhập từ tab đang mở không?
 *
 * Lỗi anh báo 08/10/2026: nút "mở xem" ở gợi ý tên người gửi (và Ctrl/⌘+bấm vào dòng danh sách) mở TAB MỚI, tab ấy bắt
 * đăng nhập lại. Nguyên nhân: token truy cập nằm ở `sessionStorage`, RIÊNG TỪNG TAB, và tab mở bằng `window.open(...,
 * 'noopener')` / Ctrl+bấm / nút giữa KHÔNG thừa hưởng nó; `ProtectedRoute` chỉ nhìn token ấy nên đẩy sang /login.
 *
 * VÌ SAO PHẢI CHẠY Ở ĐÂY: jsdom không có khái niệm "tab", không có `noopener`, không phân biệt `sessionStorage` của hai
 * tab và không phát `BroadcastChannel` giữa các trang. Cả ba điều đó là cốt lõi của lỗi, nên ~4.700 ca vitest đều mù với
 * nó. Cổng này nạp ĐÚNG mã `lib/chiaSePhien.ts` + `stores/auth.store.ts` (đóng gói bằng esbuild, không viết lại) vào
 * hai tab thật của Chromium và WebKit.
 *
 * GIỚI HẠN: cổng chứng minh cơ chế chia sẻ phiên, KHÔNG chứng minh `ProtectedRoute`/`main.tsx` gọi nó — phần nối dây do
 * `ProtectedRoute.phienTabMoi.test.tsx` (cổng) và ca `main.tsx` ở `chiaSePhienNoiDay.gate.test.ts` canh.
 */
const GOC_FE = path.resolve(__dirname, '../../frontend/src');
const BAN_GOC = 'http://localhost:4173';
const TRANG = `${BAN_GOC}/petitions/abc`;

const goiDongGoi = buildSync({
  stdin: {
    contents: "export * from '@/lib/chiaSePhien'; export { authStore } from '@/stores/auth.store';",
    resolveDir: GOC_FE,
    sourcefile: 'vao.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'PC02',
  write: false,
  platform: 'browser',
  target: 'es2020',
  alias: { '@': GOC_FE },
}).outputFiles[0].text;

function jwt(exp = Math.floor(Date.now() / 1000) + 3600): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256' })}.${b({ sub: 'u1', exp })}.chu-ky`;
}

/** Cả "máy chủ" lẫn trang chỉ là một khung HTML rỗng: chỉ cần một NGUỒN GỐC thật để có storage và kênh. */
async function dungNguonGoc(ctx: BrowserContext) {
  await ctx.route(`${BAN_GOC}/**`, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>pc02</title><a id="l" href="/petitions/abc" target="_blank">mo</a>' }),
  );
}

async function nap(page: Page) {
  await page.addScriptTag({ content: goiDongGoi });
}

/** Tab đang đăng nhập: có token ở sessionStorage + refresh token ở localStorage, và đang trả lời tab khác. */
async function tabDangNhap(ctx: BrowserContext, token: string): Promise<Page> {
  const a = await ctx.newPage();
  await a.goto(TRANG);
  await a.evaluate((t) => {
    sessionStorage.setItem('accessToken', t);
    localStorage.setItem('refreshToken', 'rt');
  }, token);
  await nap(a);
  await a.evaluate(() => (window as unknown as { PC02: { batDauTraLoiPhien(): void } }).PC02.batDauTraLoiPhien());
  return a;
}

type Cua = { PC02: { xinPhienTuTabKhac(ms?: number): Promise<boolean>; authStore: { clearTokens(): void } } };

test.describe('Chia sẻ phiên giữa các tab — hợp đồng theo engine', () => {
  test('NGUYÊN NHÂN GỐC: tab mở bằng window.open + noopener có sessionStorage RỖNG (nhưng localStorage thì có)', async ({ context }) => {
    await dungNguonGoc(context);
    const a = await tabDangNhap(context, jwt());
    const [mo] = await Promise.all([
      context.waitForEvent('page'),
      a.evaluate((u) => void window.open(u, '_blank', 'noopener,noreferrer'), TRANG),
    ]);
    await mo.waitForLoadState();
    expect(await mo.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
    expect(await mo.evaluate(() => localStorage.getItem('refreshToken'))).toBe('rt');
  });

  test('tab noopener xin phiên từ tab đang đăng nhập → nhận đúng token, ghi vào sessionStorage CỦA NÓ', async ({ context }) => {
    await dungNguonGoc(context);
    const token = jwt();
    const a = await tabDangNhap(context, token);
    const [mo] = await Promise.all([
      context.waitForEvent('page'),
      a.evaluate((u) => void window.open(u, '_blank', 'noopener,noreferrer'), TRANG),
    ]);
    await mo.waitForLoadState();
    await nap(mo);
    expect(await mo.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac())).toBe(true);
    expect(await mo.evaluate(() => sessionStorage.getItem('accessToken'))).toBe(token);
  });

  test('liên kết target=_blank bấm Ctrl/⌘ (cử chỉ "mở tab mới") cũng nhận được phiên', async ({ context }) => {
    await dungNguonGoc(context);
    const token = jwt();
    const a = await tabDangNhap(context, token);
    const [mo] = await Promise.all([context.waitForEvent('page'), a.click('#l', { modifiers: ['ControlOrMeta'] })]);
    await mo.waitForLoadState();
    await nap(mo);
    expect(await mo.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac())).toBe(true);
    expect(await mo.evaluate(() => sessionStorage.getItem('accessToken'))).toBe(token);
  });

  test('không còn tab nào đăng nhập (đóng trình duyệt rồi mở lại) → KHÔNG có phiên, phải đăng nhập lại', async ({ context }) => {
    await dungNguonGoc(context);
    const moi = await context.newPage();
    await moi.goto(TRANG);
    await moi.evaluate(() => localStorage.setItem('refreshToken', 'rt'));
    await nap(moi);
    expect(await moi.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac(300))).toBe(false);
    expect(await moi.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
  });

  test('tab đã ĐĂNG XUẤT thì ngừng chia sẻ phiên', async ({ context }) => {
    await dungNguonGoc(context);
    const a = await tabDangNhap(context, jwt());
    await a.evaluate(() => (window as unknown as Cua).PC02.authStore.clearTokens());
    const moi = await context.newPage();
    await moi.goto(TRANG);
    await nap(moi);
    expect(await moi.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac(300))).toBe(false);
  });

  test('HỒ SƠ TRÌNH DUYỆT KHÁC (context khác) không nhận được phiên', async ({ browser, context }) => {
    await dungNguonGoc(context);
    await tabDangNhap(context, jwt());
    const khac = await browser.newContext();
    await dungNguonGoc(khac);
    const p = await khac.newPage();
    await p.goto(TRANG);
    await nap(p);
    expect(await p.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac(300))).toBe(false);
    expect(await p.evaluate(() => sessionStorage.getItem('accessToken'))).toBeNull();
    await khac.close();
  });

  test('token hết hạn ở tab đang đăng nhập không được chia sẻ', async ({ context }) => {
    await dungNguonGoc(context);
    await tabDangNhap(context, jwt(Math.floor(Date.now() / 1000) - 60));
    const moi = await context.newPage();
    await moi.goto(TRANG);
    await nap(moi);
    expect(await moi.evaluate(() => (window as unknown as Cua).PC02.xinPhienTuTabKhac(300))).toBe(false);
  });
});
