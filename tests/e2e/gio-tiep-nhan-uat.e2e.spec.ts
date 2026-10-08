import { test, expect, type Page } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT GIAO DIỆN — ô "Giờ tiếp nhận" của form Đơn thư (anh yêu cầu 08/10/2026).
 *
 * Oracle (điều cán bộ thấy/làm được): gõ LIỀN số `0830` ra `08:30`; Backspace xoá được dấu `:`; giờ sai báo lỗi tại ô chứ không
 * tự sửa; mở hồ sơ CŨ thì ô để TRỐNG (không bịa giờ); lưu rồi mở lại giữ đúng giờ; xoá trắng thì lưu NULL.
 *
 * Chạy ở Chromium VÀ WebKit (Safari): jsdom không có bộ gõ/caret thật nên các ca vitest không chứng minh được điều này.
 *
 * GHI dữ liệu (tạo đơn qua API) → CHỈ chạy trên máy local; ở máy thật bị bỏ qua có chủ ý (hiện rõ là "skipped", không phải đạt).
 *   UAT_TOKEN=<token> npx playwright test --config=.pw-local.config.ts tests/e2e/gio-tiep-nhan-uat.e2e.spec.ts
 */
test.use({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });

const laLocal = (url?: string) => {
  try {
    return /^(localhost|127\.0\.0\.1)$/.test(new URL(url ?? '').hostname);
  } catch {
    return false;
  }
};

test.beforeEach(({ baseURL }) => {
  test.skip(!laLocal(baseURL), 'ca này GHI dữ liệu (tạo đơn) — chỉ chạy trên máy local');
});

async function vaoTrang(page: Page, url: string) {
  const token = getAuthToken();
  expect(token, 'cần UAT_TOKEN (đăng nhập sẵn)').toBeTruthy();
  await page.addInitScript((t: string) => {
    sessionStorage.setItem('accessToken', t);
    localStorage.setItem('refreshToken', t);
  }, token);
  await page.goto(url);
}

const oGio = (page: Page) => page.getByTestId('field-gioTiepNhan');

async function taoDonQuaApi(base: string, gioTiepNhan?: string | null) {
  const token = getAuthToken();
  const goi = async (method: string, duong: string, body?: unknown) => {
    const r = await fetch(`${base}/api/v1${duong}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`${method} ${duong} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return j;
  };
  const ds = await goi('GET', '/crimes?pc02Only=false&isActive=true&limit=1');
  const crimeChinhId = (Array.isArray(ds) ? ds : (ds.data ?? ds.items))[0].id as string;
  const homQua = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const r = await goi('POST', '/petitions', {
    receivedDate: homQua,
    senderName: `Giờ thử ${Date.now()}`,
    senderAddress: '12 Lê Lợi',
    detailContent: 'Nội dung thử giờ tiếp nhận',
    crimeChinhId,
    ...(gioTiepNhan !== undefined && { gioTiepNhan }),
  });
  const id = (r.data ?? r).id as string;
  const doc = async () => ((await goi('GET', `/petitions/${id}`)).data ?? {}).gioTiepNhan ?? null;
  return { id, doc };
}

test.describe('Ô Giờ tiếp nhận — nhập nhanh', () => {
  test('tạo mới: mặc định là GIỜ HIỆN TẠI giờ Việt Nam', async ({ page }) => {
    await vaoTrang(page, '/petitions/new');
    await expect(oGio(page)).toBeVisible({ timeout: 30_000 });
    const giaTri = await oGio(page).inputValue();
    expect(giaTri).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    const vn = await page.evaluate(() => {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date())
        .reduce<Record<string, string>>((m, x) => ({ ...m, [x.type]: x.value }), {});
      return Number(p.hour) * 60 + Number(p.minute);
    });
    const hien = Number(giaTri.slice(0, 2)) * 60 + Number(giaTri.slice(3));
    expect(Math.abs(hien - vn), 'giờ mặc định lệch quá 3 phút so với giờ VN').toBeLessThanOrEqual(3);
  });

  test('gõ LIỀN số: 0830 → 08:30; 830 + Tab → 08:30; 9 + Tab → 09:00; 14 + Tab → 14:00', async ({ page }) => {
    await vaoTrang(page, '/petitions/new');
    const o = oGio(page);
    await expect(o).toBeVisible({ timeout: 30_000 });
    const go = async (chuoi: string) => {
      await o.fill('');
      await o.click();
      await page.keyboard.type(chuoi);
    };
    await go('0830');
    await expect(o).toHaveValue('08:30');
    await go('830');
    await expect(o).toHaveValue('8:30');
    await page.keyboard.press('Tab');
    await expect(o).toHaveValue('08:30');
    await go('9');
    await page.keyboard.press('Tab');
    await expect(o).toHaveValue('09:00');
    await go('14');
    await page.keyboard.press('Tab');
    await expect(o).toHaveValue('14:00');
  });

  test('Backspace xoá được cả dấu ":" — không kẹt', async ({ page }) => {
    await vaoTrang(page, '/petitions/new');
    const o = oGio(page);
    await expect(o).toBeVisible({ timeout: 30_000 });
    await o.fill('');
    await o.click();
    await page.keyboard.type('0830');
    await expect(o).toHaveValue('08:30');
    for (const ky_vong of ['08:3', '08:', '08', '0', '']) {
      await page.keyboard.press('Backspace');
      await expect(o).toHaveValue(ky_vong);
    }
  });

  test('giờ SAI báo lỗi tại ô, KHÔNG tự sửa: 2450 → "24:50" + lỗi; sửa lại thì lỗi hết', async ({ page }) => {
    await vaoTrang(page, '/petitions/new');
    const o = oGio(page);
    await expect(o).toBeVisible({ timeout: 30_000 });
    await o.fill('');
    await o.click();
    await page.keyboard.type('2450');
    await page.keyboard.press('Tab');
    await expect(o).toHaveValue('24:50');
    await expect(page.getByTestId('field-gioTiepNhan-loi')).toHaveText('Giờ phải từ 00 đến 23');
    await expect(o).toHaveAttribute('aria-invalid', 'true');
    await o.fill('08:3');
    await expect(page.getByTestId('field-gioTiepNhan-loi')).toHaveCount(0);
  });

  test('phím ↑/↓ ±1 phút, Shift ±1 giờ; nút "Bây giờ" đặt giờ hiện tại', async ({ page }) => {
    await vaoTrang(page, '/petitions/new');
    const o = oGio(page);
    await expect(o).toBeVisible({ timeout: 30_000 });
    await o.fill('09:30');
    await o.focus();
    await page.keyboard.press('ArrowUp');
    await expect(o).toHaveValue('09:31');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(o).toHaveValue('08:31');
    await page.getByTestId('field-gioTiepNhan-bay-gio').click();
    await expect(o).toHaveValue(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});

test.describe('Ô Giờ tiếp nhận — dữ liệu thật', () => {
  test('hồ sơ CÓ giờ: màn xem chỉ đọc (vẫn chép được), không có nút "Bây giờ"', async ({ page, baseURL }) => {
    const { id } = await taoDonQuaApi(baseURL!, '09:30');
    await vaoTrang(page, `/petitions/${id}`);
    await expect(oGio(page)).toHaveValue('09:30', { timeout: 30_000 });
    await expect(oGio(page)).toHaveJSProperty('readOnly', true);
    await expect(oGio(page)).toHaveJSProperty('disabled', false);
    await expect(page.getByTestId('field-gioTiepNhan-bay-gio')).toHaveCount(0);
  });

  test('hồ sơ CŨ chưa có giờ: ô để TRỐNG (không bịa "bây giờ"); lưu không đụng giờ → vẫn NULL', async ({ page, baseURL }) => {
    const { id, doc } = await taoDonQuaApi(baseURL!);
    expect(await doc()).toBeNull();
    await vaoTrang(page, `/petitions/${id}/edit`);
    await expect(oGio(page)).toBeVisible({ timeout: 30_000 });
    await expect(oGio(page)).toHaveValue('');
    const luu = page.waitForResponse((r) => r.url().includes(`/petitions/${id}`) && r.request().method() === 'PUT');
    await page.keyboard.press('F2');
    expect((await luu).status()).toBeLessThan(300);
    expect(await doc()).toBeNull();
  });

  test('sửa giờ rồi lưu: gõ 1015 → máy chủ lưu "10:15"; mở lại thấy 10:15', async ({ page, baseURL }) => {
    const { id, doc } = await taoDonQuaApi(baseURL!, '09:30');
    await vaoTrang(page, `/petitions/${id}/edit`);
    const o = oGio(page);
    await expect(o).toHaveValue('09:30', { timeout: 30_000 });
    await o.fill('');
    await o.click();
    await page.keyboard.type('1015');
    await expect(o).toHaveValue('10:15');
    const luu = page.waitForResponse((r) => r.url().includes(`/petitions/${id}`) && r.request().method() === 'PUT');
    await page.keyboard.press('F2');
    expect((await luu).status()).toBeLessThan(300);
    expect(await doc()).toBe('10:15');
    await vaoTrang(page, `/petitions/${id}/edit`);
    await expect(oGio(page)).toHaveValue('10:15', { timeout: 30_000 });
  });

  test('xoá trắng ô giờ rồi lưu → máy chủ lưu NULL (gửi null, không bỏ khoá)', async ({ page, baseURL }) => {
    const { id, doc } = await taoDonQuaApi(baseURL!, '09:30');
    await vaoTrang(page, `/petitions/${id}/edit`);
    const o = oGio(page);
    await expect(o).toHaveValue('09:30', { timeout: 30_000 });
    await o.fill('');
    const luu = page.waitForResponse((r) => r.url().includes(`/petitions/${id}`) && r.request().method() === 'PUT');
    await page.keyboard.press('F2');
    expect((await luu).status()).toBeLessThan(300);
    expect(await doc()).toBeNull();
  });

  test('giờ dở dang "8:3" chặn Lưu (không gửi lời gọi ghi) và báo lỗi tại ô', async ({ page, baseURL }) => {
    const { id, doc } = await taoDonQuaApi(baseURL!, '09:30');
    await vaoTrang(page, `/petitions/${id}/edit`);
    const o = oGio(page);
    await expect(o).toHaveValue('09:30', { timeout: 30_000 });
    await o.fill('8:3');
    let daGhi = false;
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes(`/petitions/${id}`)) daGhi = true;
    });
    await page.keyboard.press('F2');
    await expect(page.getByTestId('field-gioTiepNhan-loi')).toBeVisible();
    await page.waitForTimeout(500);
    expect(daGhi).toBe(false);
    expect(await doc()).toBe('09:30');
  });
});
