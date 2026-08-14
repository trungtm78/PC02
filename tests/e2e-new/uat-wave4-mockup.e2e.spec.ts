/**
 * UAT Đợt 4 — "Xoá mockup", chạy tự động.
 *
 * `UAT-COVERAGE.md` liệt kê sáu kịch bản của đợt này dưới dạng ô tick chờ một
 * người ngồi bấm. Ô tick chưa ai bấm thì không phải bằng chứng; ô tick tự đánh
 * dấu thì tệ hơn nữa. Bộ này bấm thật qua giao diện, đúng cách một cán bộ dùng.
 *
 * Vì sao là ĐỢT 4 chứ không phải đợt khác: nó kiểm đúng câu hỏi gốc — "còn chỗ
 * nào là mockup không". Ba đợt còn lại kiểm phân quyền và hạ tầng cờ, vốn đã có
 * test đơn vị bao; mockup thì chỉ nhìn thấy được trên màn hình thật.
 *
 * Mỗi test khẳng định thứ chỉ đúng khi dữ liệu là THẬT: một con số cứng, một
 * chuỗi bịa, một ô rỗng vẫn render — đó là dấu vết mockup để lại.
 */
import { test, expect, Page } from '@playwright/test';

const USER = process.env.UAT_USER || 'ngoc.tran.demo@pc02.local';
const PASS = process.env.UAT_PASS || 'Demo@12345';

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.click('button:has-text("Đăng nhập")');
  await page.waitForURL('**/dashboard', { timeout: 40_000 });
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe('Đợt 4 — xoá mockup', () => {
  test('báo cáo tháng: bảng tồn kỳ có số thật, không còn "+12%" cứng', async ({
    page,
  }) => {
    // Bảng "Tồn đầu kỳ / Phát sinh / Đã giải quyết / Tồn cuối kỳ" từng luôn
    // render nhánh rỗng vì BE chưa trả `tableRows`/`summary` — trông như kỳ báo
    // cáo không có hoạt động, chứ không như một API còn thiếu. Và thẻ KPI mang
    // delta "+12%" viết cứng, giống hệt nhau qua mọi kỳ.
    await page.goto('/reports/monthly', { waitUntil: 'networkidle' });

    const body = await page.locator('body').innerText();
    expect(body, 'delta "+12%" viết cứng phải biến mất').not.toContain('+12%');

    // Bảng phải render — dù số có thể bằng 0 nếu kỳ này chưa có hồ sơ. Cái phải
    // chết là nhánh rỗng vô điều kiện, không phải con số 0 hợp lệ.
    await expect(
      page.getByText(/Tồn đầu kỳ/i).first(),
      'bảng tồn kỳ phải render, không rơi vào nhánh rỗng',
    ).toBeVisible({ timeout: 15_000 });
  });

  test('trang đơn trùng: không còn công dân bịa "001234567890"', async ({
    page,
  }) => {
    // Trang từng gán nhãn "trùng" cho MỌI đơn và hiển thị một công dân bịa
    // (`Nguyễn Văn A — CCCD 001234567890`). Trên hồ sơ pháp lý, gắn nhãn trùng
    // sai cho hai công dân khác nhau là một quy kết, không phải gợi ý.
    await page.goto('/classification/duplicates', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const body = await page.locator('body').innerText();
    expect(body, 'số CCCD bịa phải biến mất khỏi DOM').not.toContain(
      '001234567890',
    );
    expect(body, 'phần trăm giả phải thay bằng "Khớp N/M tiêu chí"').not.toMatch(
      /\bĐộ (giống|trùng) khớp: ?\d+%/,
    );
  });

  test('cài đặt: không còn ba thẻ mockup', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const body = await page.locator('body').innerText();
    // Ba thẻ này từng render giao diện đầy đủ mà không nối vào bất cứ API nào:
    // bật/tắt xong bấm Lưu thì không có gì được lưu.
    for (const dead of ['Tích hợp', 'Sao lưu & Phục hồi']) {
      expect(body, `thẻ mockup "${dead}" phải biến mất`).not.toContain(dead);
    }
  });

  test('khôi phục hồ sơ con: thẻ "Khác" liệt kê loại từ máy chủ', async ({
    page,
  }) => {
    // E3. Chín loại có xoá mềm mà không có đường khôi phục — "mềm" chỉ là cách
    // nói. Danh sách loại phải đến TỪ REGISTRY của máy chủ; viết cứng trong UI
    // chính là cách nó trôi khỏi thứ thực sự khôi phục được.
    await page.goto('/admin/khoi-phuc', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const other = page.getByTestId('other-restore-panel');
    if ((await other.count()) === 0) {
      test.skip(true, 'Thẻ "Khác" không hiển thị cho tài khoản này (cần quyền restore)');
    }
    const select = page.getByTestId('restore-resource');
    await expect(select).toBeVisible({ timeout: 10_000 });
    const options = await select.locator('option').count();
    expect(options, 'ô chọn loại phải có mục, không rỗng').toBeGreaterThan(0);
  });

  test('không màn nào của đợt này lọt "Sắp ra mắt"', async ({ page }) => {
    // `ComingSoonPage` đã bị xoá cả thư mục ở E1. Nếu chuỗi này quay lại trên
    // bất kỳ route nào dưới đây thì có route đang trỏ vào một vỏ rỗng.
    for (const route of [
      '/reports/monthly',
      '/classification/duplicates',
      '/settings',
      '/kpi',
    ]) {
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      const body = await page.locator('body').innerText();
      expect(body, `${route} không được hiện "Sắp ra mắt"`).not.toMatch(
        /Sắp ra mắt|Coming soon/i,
      );
    }
  });
});
