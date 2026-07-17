/**
 * Clip 01 — Đăng nhập hệ thống.
 * Quay luồng đăng nhập THẬT (không inject token).
 */
import { ACCOUNTS } from '../guide.config.mjs';

const acc = ACCOUNTS.admin;

/** Gõ từng ký tự cho tự nhiên. */
async function typeSlow(page, selector, text) {
  const el = page.locator(selector).first();
  await el.click();
  await el.fill('');
  await el.pressSequentially(text, { delay: 55 });
}

export default {
  slug: '01-dang-nhap',
  title: 'Đăng nhập hệ thống',
  requiresAuth: false,
  steps: [
    {
      narration:
        'Chào mừng quý vị đến với Hệ thống quản lý vụ án của Phòng Cảnh sát điều tra. Trong video này, chúng ta sẽ cùng thực hiện bước đầu tiên: đăng nhập vào hệ thống.',
      async run(page, ctx) {
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Tại màn hình đăng nhập, quý vị nhập tên đăng nhập được cấp vào ô đầu tiên. Tên đăng nhập thường là địa chỉ thư điện tử công vụ của cán bộ.',
      async run(page) {
        await typeSlow(page, 'input[type="email"], input[name="username"], input[name="email"], input[type="text"]', acc.username);
      },
    },
    {
      narration:
        'Tiếp theo, nhập mật khẩu vào ô mật khẩu. Quý vị lưu ý giữ bí mật mật khẩu và không chia sẻ tài khoản cho người khác.',
      async run(page) {
        await typeSlow(page, 'input[type="password"]', acc.password);
      },
    },
    {
      narration:
        'Sau khi nhập đầy đủ thông tin, quý vị bấm nút Đăng nhập để vào hệ thống.',
      async run(page) {
        await page.click('button[type="submit"]');
        await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(800);
      },
    },
    {
      narration:
        'Đăng nhập thành công, hệ thống đưa quý vị tới màn hình Tổng quan. Bên trái là thanh điều hướng chứa toàn bộ nghiệp vụ, được sắp xếp theo trình tự xử lý hồ sơ.',
      async run(page) {
        await page.waitForTimeout(500);
      },
    },
  ],
};
