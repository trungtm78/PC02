/**
 * UAT v0.72.0.0 — E2E hành trình người dùng thật trên trình duyệt.
 *
 * ⚠️ Kết quả mong đợi lấy từ `docs/uat/list-sort/_plan-scope.md`, KHÔNG lấy từ mã.
 * Chạy trên BẢN CHẠY THẬT, dữ liệu thật. Toàn bộ CHỈ ĐỌC — không tạo/sửa/xoá hồ sơ.
 *
 * Vai: cán bộ mở danh sách hằng ngày để tìm hồ sơ cần xử lý.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginToPage } from '../helpers/auth';

/** Đọc cột ngày theo tiêu đề, trả về mảng chuỗi dd/MM/yyyy theo thứ tự hiển thị. */
async function docCotNgay(page: Page, tieuDe: string): Promise<string[]> {
  const headers = page.locator('thead th');
  const n = await headers.count();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    const t = (await headers.nth(i).innerText()).trim();
    if (t.startsWith(tieuDe)) { idx = i; break; }
  }
  expect(idx, `phải tìm thấy cột "${tieuDe}" trên bảng`).toBeGreaterThanOrEqual(0);
  return page.locator('tbody tr').evaluateAll(
    (rows, i) =>
      rows.map((r) => (r.querySelectorAll('td')[i as number]?.textContent ?? '').trim()),
    idx,
  );
}

/** dd/MM/yyyy → số so sánh được; '—' hoặc rỗng → null. */
function soNgay(s: string): number | null {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return Number(`${m[3]}${m[2]}${m[1]}`);
}

function kiemGiamDan(vals: (number | null)[], nhan: string) {
  const co = vals.filter((v): v is number => v !== null);
  for (let i = 1; i < co.length; i++) {
    expect(co[i] <= co[i - 1], `${nhan}: dòng ${i + 1} phải cũ hơn hoặc bằng dòng trước`).toBe(true);
  }
}

test.describe('E2E — cán bộ mở danh sách', () => {
  test('TC-050 [COV-E2E-01] Đơn thư: hồ sơ mới nhất hiện đầu tiên', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await expect(page.locator('h1').filter({ hasText: /danh sách đơn thư/i }).first()).toBeVisible();
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });

    const ngay = (await docCotNgay(page, 'Ngày nhận')).map(soNgay);
    expect(ngay.length, 'phải có dữ liệu để đánh giá thứ tự').toBeGreaterThan(1);
    kiemGiamDan(ngay, 'Đơn thư');
  });

  test('TC-034 [COV-COL-01] Đơn thư có ĐỦ hai cột ngày', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
    const tieuDe = await page.locator('thead th').allInnerTexts();
    const gop = tieuDe.join(' | ');
    expect(gop, 'phải có cột ngày nhận').toMatch(/Ngày nhận/);
    expect(gop, 'phải có cột ngày tạo').toMatch(/Ngày tạo/);
  });

  test('TC-053 [COV-E2E-04] Vụ việc và Vụ án cùng hành vi', async ({ page }) => {
    for (const [duongDan, tieuDe] of [
      ['/incidents', 'Ngày tiếp nhận'],
      ['/cases', 'Ngày tiếp nhận'],
    ] as const) {
      await loginToPage(page, duongDan);
      await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
      const ngay = (await docCotNgay(page, tieuDe)).map(soNgay);
      kiemGiamDan(ngay, duongDan);
    }
  });
});

test.describe('E2E — bấm cột để sắp', () => {
  test('TC-051 [COV-E2E-02] Bấm cột đổi thứ tự THẬT SỰ', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });

    const truoc = await docCotNgay(page, 'Ngày nhận');
    const nut = page.getByTestId('sort-receivedDate');
    await expect(nut, 'tiêu đề cột ngày nhận phải bấm được').toBeVisible();

    // Nhịp 1 = giảm dần (đang là mặc định) → nhịp này chuyển sang trạng thái tường minh.
    await nut.click();
    await page.waitForTimeout(1500);
    // Nhịp 2 = tăng dần → thứ tự PHẢI đổi so với ban đầu.
    await nut.click();
    await page.waitForTimeout(1500);

    const sau = await docCotNgay(page, 'Ngày nhận');
    expect(sau.join('|'), 'sau khi đảo chiều, danh sách phải KHÁC lúc đầu').not.toBe(
      truoc.join('|'),
    );
    kiemGiamDan(
      sau.map(soNgay).map((v) => (v === null ? null : -v)),
      'sau khi đảo sang tăng dần',
    );
  });

  test('TC-023 [COV-CLICK-06] aria-sort báo đúng trạng thái', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });

    const th = page.locator('thead th').filter({ hasText: 'Ngày nhận' }).first();
    await page.getByTestId('sort-receivedDate').click();
    await page.waitForTimeout(1200);
    expect(
      await th.getAttribute('aria-sort'),
      'trình đọc màn hình phải biết cột đang sắp giảm dần',
    ).toBe('descending');

    await page.getByTestId('sort-receivedDate').click();
    await page.waitForTimeout(1200);
    expect(await th.getAttribute('aria-sort')).toBe('ascending');
  });

  test('TC-022 [COV-CLICK-05] Cột "Thao tác" KHÔNG bấm được', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
    const th = page.locator('thead th').filter({ hasText: 'Thao tác' }).first();
    expect(
      await th.locator('button').count(),
      'cột không có ý nghĩa sắp thì không được là nút',
    ).toBe(0);
  });
});

test.describe('E2E — giữ thứ tự qua địa chỉ trang', () => {
  test('TC-025+TC-026 [COV-URL-01/02] Bấm sắp ghi vào địa chỉ, F5 giữ nguyên', async ({ page }) => {
    await loginToPage(page, '/petitions');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });

    await page.getByTestId('sort-receivedDate').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('sort-receivedDate').click(); // sang tăng dần
    await page.waitForTimeout(1500);

    expect(page.url(), 'thứ tự phải nằm trong địa chỉ trang để chia sẻ được').toMatch(
      /petitions_sort=receivedDate/,
    );
    const truocF5 = await docCotNgay(page, 'Ngày nhận');

    await page.reload();
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
    const sauF5 = await docCotNgay(page, 'Ngày nhận');

    expect(sauF5.join('|'), 'tải lại trang phải giữ nguyên thứ tự').toBe(truocF5.join('|'));
  });

  test('TC-027 [COV-URL-03] Mở thẳng đường dẫn có tham số → đúng thứ tự', async ({ page }) => {
    await loginToPage(page, '/petitions?petitions_sort=receivedDate&petitions_dir=asc');
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
    const ngay = (await docCotNgay(page, 'Ngày nhận')).map(soNgay);
    const co = ngay.filter((v): v is number => v !== null);
    for (let i = 1; i < co.length; i++) {
      expect(co[i] >= co[i - 1], 'đường dẫn chỉ định tăng dần thì phải tăng dần').toBe(true);
    }
  });
});
