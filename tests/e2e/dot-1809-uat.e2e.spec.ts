import { test, expect, type Page, type Download } from '@playwright/test';
import * as path from 'path';
import { createRequire } from 'module';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT GIAO DIỆN — đợt 18/09/2026 (docs/uat/dot-1809). Chrome thật, backend + CSDL thật, không mock gì của mình
 * (trừ /health ở R1 — xem _domain-pack.md "Mock allowlist").
 *
 * Oracle = yêu cầu anh 18/09 (YC-1..6, QĐ-1..5), KHÔNG phải hành vi mã hiện tại. Mỗi ca ghi rule_id.
 *
 * Chạy: UAT_PROD=1 BASE_URL=<gốc giao diện> ADMIN_USERNAME=… ADMIN_PASSWORD=… npx playwright test
 *        --project=e2e-chromium tests/e2e/dot-1809-uat.e2e.spec.ts
 * UAT_BAN_SAO=1 bật thêm hành trình J-TIM (hồ sơ hệ cũ vừa nạp) — chỉ có trên bản sao đã chạy CLI.
 */
const GOC = process.env.BASE_URL ?? 'http://localhost:5173';
const API = `${GOC}/api/v1`;
const LA_BAN_SAO = process.env.UAT_BAN_SAO === '1';
// exceljs có sẵn ở backend — đọc tệp tải về đúng như cán bộ mở bằng Excel.
const ExcelJS = createRequire(__filename)(path.resolve(__dirname, '../../backend/node_modules/exceljs'));

// Chặn service worker: yêu cầu đi qua SW không qua được `page.route` (giả lập /health ở R1 sẽ không tới trang).
test.use({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });

const MAN = [
  { ten: 'Đơn thư', url: '/petitions', tong: 'Tổng đơn thư', khoaMatDo: 'petitions' },
  { ten: 'Vụ án', url: '/cases', tong: 'Tổng vụ án', khoaMatDo: 'cases' },
  { ten: 'Vụ việc', url: '/incidents', tong: 'Tổng vụ việc', khoaMatDo: 'incidents' },
] as const;

/**
 * Gắn token (đăng nhập qua API ở global-setup) rồi mở màn, chờ BẢNG hiện. KHÔNG chờ `networkidle`: trang giữ một
 * kết nối SSE (thông báo) mở suốt nên mạng không bao giờ "rảnh" — `loginToPage` chờ nó là treo tới hết giờ.
 */
async function moDanhSach(page: Page, url: string) {
  const token = getAuthToken();
  expect(token, 'global-setup phải đăng nhập được').toBeTruthy();
  await page.addInitScript((t: string) => {
    sessionStorage.setItem('accessToken', t);
  }, token);
  await page.goto(url);
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Chờ danh sách tải lại sau khi đổi bộ lọc: con số "Hiển thị x / N" đổi khác giá trị cũ. */
async function choDanhSachDoi(page: Page, truoc: number) {
  await expect.poll(() => tongDanhSach(page), { timeout: 20_000 }).not.toBe(truoc);
}

/** "Hiển thị 20 / 46741 bản ghi" → 46741 */
async function tongDanhSach(page: Page): Promise<number> {
  const t = await page.getByText(/Hiển thị \d+ \/ [\d.]+ bản ghi/).first().textContent();
  return Number((/\/\s*([\d.]+)/.exec(t ?? '')?.[1] ?? '').replace(/\./g, ''));
}

async function soTheTong(page: Page, nhan: string): Promise<number> {
  const the = page.locator('button, div').filter({ hasText: nhan }).last();
  const t = (await the.textContent()) ?? '';
  return Number((/([\d.]+)\s*$/.exec(t.replace(nhan, '').trim())?.[1] ?? '').replace(/\./g, ''));
}

async function docExcel(dl: Download) {
  const tep = await dl.path();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tep);
  const ws = wb.worksheets[0];
  const tieuDe = ((ws.getRow(7).values as unknown[]) ?? []).slice(1).map(String);
  let soDong = 0;
  const dauTien: unknown[] = [];
  ws.eachRow((row: { getCell: (i: number) => { value: unknown } }, i: number) => {
    if (i >= 8 && typeof row.getCell(1).value === 'number') {
      soDong++;
      if (soDong === 1) dauTien.push(row.getCell(2).value);
    }
  });
  return { tieuDe, soDong, maDauTien: String(dauTien[0] ?? ''), trangIn: ws.pageSetup };
}

/**
 * Mở khung Bộ lọc, chọn ĐÚNG người nhập của dòng đầu danh sách (chắc chắn có hồ sơ — người đầu ô chọn có thể
 * chưa nhập gì), Áp dụng.
 */
async function locTheoCanBoDauTien(page: Page): Promise<string> {
  const iCot = (await page.locator('thead th').allTextContents()).findIndex((t) => /Người nhập/.test(t));
  expect(iCot, 'bảng phải có cột Người nhập').toBeGreaterThanOrEqual(0);
  const ten = ((await page.locator('tbody tr').first().locator('td').nth(iCot).textContent()) ?? '').trim();
  expect(ten && ten !== '—', 'dòng đầu phải có người nhập').toBeTruthy();
  await page.getByTestId('list-page-shell-filter-toggle').click();
  const o = page.getByTestId('filter-can-bo-nhap');
  await expect(o).toBeVisible();
  const giaTri = await o.evaluate(
    (el, t) => [...(el as HTMLSelectElement).options].find((x) => x.value && x.textContent?.trim() === t)?.value ?? '',
    ten,
  );
  expect(giaTri, `ô Cán bộ nhập phải có "${ten}"`).toBeTruthy();
  const truoc = await tongDanhSach(page);
  await o.selectOption(giaTri);
  await page.getByTestId('btn-apply-filters').click();
  await choDanhSachDoi(page, truoc);
  return giaTri;
}

// ───────────────────────── YC-1 · tự cập nhật, không hộp nhắc ─────────────────────────
test.describe('YC-1 tự cập nhật', () => {
  const HOP_NHAC = /bản cũ|cập nhật ngay|phiên bản mới|tải lại để cập nhật/i;

  test('E01 [R1-NODIALOG, R1-ROUTE] có bản mới: không hộp nhắc; chuyển màn → tải lại ở màn đích', async ({ page }) => {
    await page.route('**/api/v1/health', async (r) => {
      const res = await r.fetch();
      const body = await res.json();
      await r.fulfill({ response: res, json: { ...body, buildId: 'uat-ban-moi-1809' } });
    });
    await moDanhSach(page, '/petitions');
    await page.evaluate(() => ((window as unknown as { __uat: number }).__uat = 1));
    await page.waitForTimeout(2500); // đủ cho lượt hỏi /health lúc vào màn
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(HOP_NHAC)).toHaveCount(0);

    await page.locator('a[href="/cases"]').first().click();
    await page.waitForURL(/\/cases$/);
    // Tải lại chạy SAU khi gỡ service worker + xoá kho (bất đồng bộ) — thăm dò tới khi trang mới lên.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __uat?: number }).__uat).catch(() => 'dang-tai'), {
        timeout: 15_000,
        message: 'chuyển màn khi có bản mới phải TẢI LẠI trang (mất biến cửa sổ)',
      })
      .toBeUndefined();
    await expect(page).toHaveURL(/\/cases$/);
    await expect(page.getByText(HOP_NHAC)).toHaveCount(0);
  });

  test('E02 [R1-SAME] cùng bản → chuyển màn KHÔNG tải lại trang', async ({ page }) => {
    await moDanhSach(page, '/petitions');
    await page.evaluate(() => ((window as unknown as { __uat: number }).__uat = 1));
    await page.waitForTimeout(1500);
    await page.locator('a[href="/cases"]').first().click();
    await page.waitForURL(/\/cases$/);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __uat?: number }).__uat)).toBe(1);
  });

  test('E03 [R1-HEALTHERR] /health lỗi → không tải lại, không báo gì', async ({ page }) => {
    await page.route('**/api/v1/health', (r) => r.fulfill({ status: 503, body: 'down' }));
    await moDanhSach(page, '/petitions');
    await page.evaluate(() => ((window as unknown as { __uat: number }).__uat = 1));
    await page.locator('a[href="/cases"]').first().click();
    await page.waitForURL(/\/cases$/);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __uat?: number }).__uat)).toBe(1);
    await expect(page.getByText(HOP_NHAC)).toHaveCount(0);
  });
});

// ─────────────── YC-2 · Tóm tắt 5 dòng + Xem thêm tại chỗ (4 màn) ───────────────
const MAN_TOM_TAT = [...MAN.map((m) => ({ ten: m.ten, url: m.url })), { ten: 'Đơn thư phường', url: '/ward/petitions' }];

for (const m of MAN_TOM_TAT) {
  test(`E04 [R2-CLAMP5, R2-NOBTN, R2-INPLACE] ${m.ten}: 5 dòng, nút chỉ khi tràn, bung tại chỗ`, async ({ page }) => {
    await moDanhSach(page, m.url);
    await expect(page.locator('[data-testid=summary-text]').first()).toBeVisible();
    const do_ = await page.evaluate(() => {
      const o = [...document.querySelectorAll<HTMLElement>('[data-testid=summary-text]')];
      const tran = o.filter((x) => x.scrollHeight > x.clientHeight + 1);
      const lh = tran[0] ? parseFloat(getComputedStyle(tran[0]).lineHeight) : 0;
      return {
        tran: tran.length,
        nut: [...document.querySelectorAll('button')].filter((b) => /Xem thêm/.test(b.textContent ?? '')).length,
        soDongO: tran.map((x) => Math.round(x.clientHeight / lh)),
      };
    });
    expect(do_.nut, 'số nút "Xem thêm" = số ô tràn thật').toBe(do_.tran);
    test.skip(do_.tran === 0, 'trang đầu không có tóm tắt nào dài quá 5 dòng');
    for (const n of do_.soDongO) expect(n).toBe(5);

    const url = page.url();
    // Đánh dấu CỐ ĐỊNH ô được bấm: bấm xong nút đổi chữ thành "Thu gọn", bộ chọn theo chữ sẽ trỏ sang ô kế tiếp.
    await page
      .getByRole('button', { name: /Xem thêm/ })
      .first()
      .evaluate((b) => b.parentElement?.setAttribute('data-uat', 'o-dang-thu'));
    const khung = page.locator('[data-uat=o-dang-thu]');
    const o = khung.locator('[data-testid=summary-text]');
    await khung.getByRole('button', { name: /Xem thêm/ }).click();
    await expect(khung.getByRole('button', { name: /Thu gọn/ })).toBeVisible();
    expect(page.url(), 'bung tại chỗ — không chuyển màn').toBe(url);
    // Dung sai 2px: chiều cao dòng lẻ (26,16px) làm tròn khác nhau giữa scrollHeight và clientHeight.
    expect(await o.evaluate((x) => x.scrollHeight <= x.clientHeight + 2)).toBe(true);
    await khung.getByRole('button', { name: /Thu gọn/ }).click();
    expect(await o.evaluate((x) => Math.round(x.clientHeight / parseFloat(getComputedStyle(x).lineHeight)))).toBe(5);
  });
}

test('E05 [R2-KEY] Đơn thư phường: Enter trên "Xem thêm" không mở hồ sơ (dòng có onKeyDown)', async ({ page }) => {
  await moDanhSach(page, '/ward/petitions');
  const nut = page.getByRole('button', { name: /Xem thêm/ }).first();
  test.skip((await nut.count()) === 0, 'trang đầu không có tóm tắt dài');
  const url = page.url();
  await nut.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Thu gọn/ }).first()).toBeVisible();
  await page.keyboard.press(' ');
  expect(page.url()).toBe(url);
});

test('E06 [R2-INPLACE] bấm vào CHỮ tóm tắt (ngoài nút) vẫn mở hồ sơ như mọi ô', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  await page.locator('[data-testid=summary-text]').first().click();
  await page.waitForURL(/\/petitions\/[^/]+/);
});

// ─────── YC-3/YC-4 · xuống dòng, ngày một dòng, thanh cuộn trên (3 màn + phường) ───────
for (const m of MAN) {
  test(`E07 [R3-WRAP, R3-ONELINE, R3-SCROLL, R4-TOPBAR, R4-SYNC] ${m.ten}`, async ({ page }) => {
    await moDanhSach(page, m.url);
    const d = await page.evaluate(() => {
      const bang = document.querySelector('table') as HTMLTableElement;
      const khung = bang.parentElement as HTMLElement;
      const thanh = document.querySelector('[data-testid=thanh-cuon-ngang-tren]') as HTMLElement | null;
      const oChu = [...document.querySelectorAll('tbody tr:first-child td')].map((td) => getComputedStyle(td).whiteSpace);
      const oSo = [...document.querySelectorAll<HTMLElement>('tbody td span.font-mono')];
      const tran = oSo.filter((s) => {
        const td = s.closest('td') as HTMLElement;
        const cs = getComputedStyle(td);
        return s.getBoundingClientRect().width > td.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5;
      }).length;
      const hai = oSo.filter((s) => s.getClientRects().length > 1).length;
      return {
        wrap: oChu.filter((w) => w === 'normal').length,
        soO: oChu.length,
        oSo: oSo.length,
        tran,
        hai,
        bangRong: khung.scrollWidth,
        khungRong: khung.clientWidth,
        coThanh: !!thanh,
        thanhTruocBang: thanh ? !!(thanh.compareDocumentPosition(bang) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
      };
    });
    expect(d.wrap, 'đa số ô dữ liệu xuống dòng').toBeGreaterThan(d.soO / 2);
    expect(d.oSo).toBeGreaterThan(0);
    expect(d.tran, 'ngày/mã không tràn cột').toBe(0);
    expect(d.hai, 'ngày/mã một dòng').toBe(0);
    expect(d.bangRong, 'bảng nhiều cột vẫn rộng hơn khung — cuộn ngang, không ép cột').toBeGreaterThan(d.khungRong);
    expect(d.coThanh).toBe(true);
    expect(d.thanhTruocBang, 'thanh cuộn nằm TRÊN bảng').toBe(true);

    const vet = await page.evaluate(async () => {
      const cho = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const thanh = document.querySelector('[data-testid=thanh-cuon-ngang-tren]') as HTMLElement;
      const khung = (document.querySelector('table') as HTMLElement).parentElement as HTMLElement;
      const theoKhung: number[] = [];
      for (let x = 0; x <= 400; x += 40) {
        khung.scrollLeft = x;
        await cho(16);
        theoKhung.push(khung.scrollLeft);
      }
      await cho(150);
      const thanhSauKhung = thanh.scrollLeft;
      thanh.scrollLeft = 120;
      await cho(200);
      return { theoKhung, thanhSauKhung, khungSauThanh: khung.scrollLeft };
    });
    for (let i = 1; i < vet.theoKhung.length; i++) {
      expect(vet.theoKhung[i], 'cuộn nhanh không giật ngược').toBeGreaterThanOrEqual(vet.theoKhung[i - 1]);
    }
    expect(vet.thanhSauKhung).toBe(400);
    expect(vet.khungSauThanh).toBe(120);
  });
}

test('E08 [R4-TOPBAR] bảng KHÔNG tràn → không có thanh cuộn trên (Đơn thư phường)', async ({ page }) => {
  await moDanhSach(page, '/ward/petitions');
  const d = await page.evaluate(() => {
    const k = (document.querySelector('[data-testid=ward-petitions-table]') as HTMLElement).parentElement as HTMLElement;
    return { tran: k.scrollWidth > k.clientWidth + 1, coThanh: !!document.querySelector('[data-testid=thanh-cuon-ngang-tren]') };
  });
  expect(d.coThanh).toBe(d.tran);
});

// ─────────────── YC-5 · Bộ lọc lọc đúng + Xuất N dòng Excel (3 màn) ───────────────
for (const m of MAN) {
  test(`E09 [R5-FILTER, R5-EXPORT] ${m.ten}: lọc Cán bộ nhập → danh sách = thẻ số = số dòng Excel, đúng cột`, async ({ page }) => {
    await moDanhSach(page, m.url);
    const tongTruoc = await tongDanhSach(page);
    await locTheoCanBoDauTien(page);
    await expect(page.locator('tbody tr').first()).toBeVisible();
    const tong = await tongDanhSach(page);
    expect(tong, 'lọc theo một cán bộ phải thu hẹp danh sách').toBeLessThan(tongTruoc);
    expect(tong).toBeGreaterThan(0);
    expect(await soTheTong(page, m.tong), 'thẻ số theo đúng bộ lọc').toBe(tong);

    const nut = page.getByTestId('btn-xuat-excel-theo-bo-loc');
    await expect(nut).toHaveText(new RegExp(`Xuất ${tong.toLocaleString('vi-VN').replace('.', '\\.')} dòng Excel`));
    const maDauMan = ((await page.locator('tbody tr').first().locator('td span.font-mono').first().textContent()) ?? '').trim();
    const tieuDeMan = (await page.locator('thead th').allTextContents())
      .map((t) => t.trim())
      .filter((t) => t && t !== 'Thao tác');
    const [dl] = await Promise.all([page.waitForEvent('download'), nut.click()]);
    const x = await docExcel(dl);
    expect(x.soDong, 'tệp = đúng số dòng đang lọc').toBe(tong);
    expect(x.tieuDe[0]).toBe('STT');
    expect(x.tieuDe.length - 1, 'tệp = đúng số cột đang hiện').toBe(tieuDeMan.length);
    expect(maDauMan.startsWith(x.maDauTien.split(' ')[0]), 'dòng đầu tệp = dòng đầu màn (cùng thứ tự)').toBe(true);
    expect(x.trangIn.orientation).toBe('landscape');
  });
}

test('E10 [R5-OFFICER] Vụ việc: lọc Cán bộ nhập ra hồ sơ và cột Người nhập có tên', async ({ page }) => {
  await moDanhSach(page, '/incidents');
  await locTheoCanBoDauTien(page);
  const tong = await tongDanhSach(page);
  expect(tong).toBeGreaterThan(0);
  const iNguoiNhap = (await page.locator('thead th').allTextContents()).findIndex((t) => /Người nhập/.test(t));
  expect(iNguoiNhap).toBeGreaterThanOrEqual(0);
  const ten = (await page.locator('tbody tr').first().locator('td').nth(iNguoiNhap).textContent())?.trim();
  expect(ten && ten !== '—', 'cột Người nhập phải có tên').toBeTruthy();
});

test('E11 [R5-LABEL] Đơn thư: chọn kỳ → nhãn "Thống kê" nói đúng kỳ đang áp dụng', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  await page.getByTestId('list-page-shell-filter-toggle').click();
  await page.getByTestId('filter-from-date').fill('2026-09-01');
  await page.getByTestId('filter-to-date').fill('2026-09-15');
  await page.getByTestId('btn-apply-filters').click();
  await expect(page.getByTestId('stats-period-label')).toContainText('01/09/2026 – 15/09/2026');
});

test('E12 [R5-APPLYFIRST] còn thay đổi chưa áp dụng → nút "Áp dụng & xuất Excel", tệp theo bộ lọc MỚI', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  const iCot = (await page.locator('thead th').allTextContents()).findIndex((t) => /Người nhập/.test(t));
  const ten = ((await page.locator('tbody tr').first().locator('td').nth(iCot).textContent()) ?? '').trim();
  await page.getByTestId('list-page-shell-filter-toggle').click();
  const o = page.getByTestId('filter-can-bo-nhap');
  const giaTri = await o.evaluate(
    (el, t) => [...(el as HTMLSelectElement).options].find((x) => x.value && x.textContent?.trim() === t)?.value ?? '',
    ten,
  );
  expect(giaTri).toBeTruthy();
  const truoc = await tongDanhSach(page);
  await o.selectOption(giaTri); // CHƯA bấm Áp dụng
  const nut = page.getByTestId('btn-xuat-excel-theo-bo-loc');
  await expect(nut).toHaveText(/Áp dụng & xuất Excel/);
  const [dl] = await Promise.all([page.waitForEvent('download'), nut.click()]);
  const x = await docExcel(dl);
  await choDanhSachDoi(page, truoc);
  const sau = await tongDanhSach(page);
  expect(sau, 'bộ lọc mới đã được áp dụng lên màn').toBeLessThan(truoc);
  expect(x.soDong, 'tệp theo bộ lọc MỚI = đúng số dòng màn đang hiện').toBe(sau);
});

test('E13 [R5-EMPTY] không có dòng nào → nút xuất khoá, không tải tệp rỗng', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  await page.getByTestId('list-page-shell-filter-toggle').click();
  await page.getByTestId('filter-from-date').fill('1990-01-01');
  await page.getByTestId('filter-to-date').fill('1990-01-02');
  await page.getByTestId('btn-apply-filters').click();
  await expect(page.getByTestId('btn-xuat-excel-theo-bo-loc')).toBeDisabled({ timeout: 20_000 });
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

// ─────────────── Tăng phạm vi · font tự host + mật độ dòng ───────────────
test('E14 [RF-FONT] font tự host, đủ glyph tiếng Việt, không gọi Google Fonts', async ({ page }) => {
  const goiNgoai: string[] = [];
  page.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) goiNgoai.push(r.url());
  });
  await moDanhSach(page, '/petitions');
  const d = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      than: getComputedStyle(document.body).fontFamily,
      tomTat: getComputedStyle(document.querySelector('[data-testid=summary-text]') as HTMLElement).fontFamily,
      vi: document.fonts.check('14px "Be Vietnam Pro"', 'Nguyễn Thị Hường ỗ ặ ự đ Ư'),
    };
  });
  expect(d.than).toMatch(/^"?Be Vietnam Pro/);
  expect(d.tomTat).toMatch(/^"?Source Serif 4/);
  expect(d.vi).toBe(true);
  expect(goiNgoai).toEqual([]);
});

test('E15 [RD-DENSITY] mật độ Gọn/Đầy đủ đổi đúng và NHỚ sau tải lại; trả về Đọc', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  const bam = (nhan: string) => page.getByTestId('chon-mat-do').getByRole('button', { name: nhan, exact: true }).click();
  const doc = () =>
    page.evaluate(() => ({
      kep: (document.querySelector('[data-testid=summary-text]')?.className.match(/line-clamp-\d/) ?? ['khong'])[0],
      nut: [...document.querySelectorAll('button')].filter((b) => /Xem thêm/.test(b.textContent ?? '')).length,
    }));
  try {
    await bam('Gọn');
    await expect.poll(doc).toEqual({ kep: 'line-clamp-1', nut: 0 });
    await bam('Đầy đủ');
    await expect.poll(doc).toEqual({ kep: 'khong', nut: 0 });
    await page.waitForTimeout(800); // lưu lên máy chủ
    await page.reload();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect(page.getByTestId('chon-mat-do').getByRole('button', { name: 'Đầy đủ' })).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await bam('Đọc');
    await page.waitForTimeout(800);
  }
  await expect.poll(doc).toMatchObject({ kep: 'line-clamp-5' });
});

test('E16 [UX/A11Y] nút có vai trò/trạng thái đọc được; không hộp thoại chen ngang khi vào màn', async ({ page }) => {
  await moDanhSach(page, '/petitions');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Mật độ dòng' })).toBeVisible();
  const nut = page.getByRole('button', { name: /Xem thêm/ }).first();
  if (await nut.count()) await expect(nut).toHaveAttribute('aria-expanded', 'false');
  // Bàn phím tới được nhóm mật độ.
  await page.getByTestId('chon-mat-do').getByRole('button', { name: 'Đọc', exact: true }).focus();
  await expect(page.getByTestId('chon-mat-do').getByRole('button', { name: 'Đọc', exact: true })).toBeFocused();
});

// ─────────────── YC-6 · dữ liệu hệ cũ thiếu (bản sao đã chạy CLI) ───────────────
test.describe('YC-6 dữ liệu hệ cũ (bản sao)', () => {
  test.skip(!LA_BAN_SAO, 'Ghi prod đang chờ anh xác nhận — chạy trên bản sao đã nạp (UAT_BAN_SAO=1)');

  async function timMoiCot(page: Page, chu: string) {
    const truoc = await tongDanhSach(page);
    const o = page.getByTestId('o-tim-kiem-the').locator('input');
    await o.fill(chu);
    await o.press('Enter');
    await choDanhSachDoi(page, truoc);
  }

  test('E17 [R6-FIND] Vụ việc: tìm "Kha Tử Thạnh" ra 26-11732', async ({ page }) => {
    await moDanhSach(page, '/incidents');
    await timMoiCot(page, 'Kha Tử Thạnh');
    await expect(page.locator('tbody')).toContainText('26-11732');
  });

  test('E18 [R6-FIND, R6-LINK] Đơn thư: tìm "Lê Nguyễn Yến Thanh" ra 26-11129 "Đã chuyển vụ án", mở sang vụ án', async ({ page }) => {
    await moDanhSach(page, '/petitions');
    await timMoiCot(page, 'Lê Nguyễn Yến Thanh');
    const dong = page.locator('tbody tr').filter({ hasText: '26-11129' }).first();
    await expect(dong).toBeVisible();
    await expect(dong).toContainText(/Đã chuyển vụ án/i);
    await dong.locator('[data-testid=summary-text]').click();
    await page.waitForURL(/\/petitions\/[^/]+/);
    await page.getByTestId('link-ho-so-da-chuyen').click();
    await page.waitForURL(/\/cases\/[^/]+/);
  });
});

test.afterAll(async ({ request }) => {
  // Trả mật độ về mặc định cho tài khoản kiểm, kể cả khi E15 đỏ giữa chừng.
  const token = getAuthToken();
  await request
    .put(`${API}/user-table-layouts/petitions/mat-do`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { matDo: 'doc' },
    })
    .catch(() => undefined);
});
