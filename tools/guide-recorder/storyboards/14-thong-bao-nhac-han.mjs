/**
 * Clip 14 — Thông báo & nhắc hạn.
 * Tour: chuông thông báo, cấu hình tùy chọn nhận tin, hồ sơ quá hạn.
 */
import { clickIfVisible, scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '14-thong-bao-nhac-han',
  title: 'Thông báo & nhắc hạn',
  role: 'admin',
  steps: [
    {
      narration:
        'Hệ thống chủ động nhắc việc qua Trung tâm thông báo. Biểu tượng chuông trên thanh trên cùng hiển thị số việc cần xử lý.',
      async run(page) {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await wait(page);
        const bell = page.locator('header button, button[aria-label*="thông báo" i]').first();
        try { await bell.click({ timeout: 3000 }); await page.waitForTimeout(1600); } catch (_e) {}
      },
    },
    {
      narration:
        'Bấm chuông để xem các thông báo mới: phân công hồ sơ, thay đổi trạng thái, nhắc hạn sắp tới hoặc đã quá hạn.',
      async run(page) { await page.waitForTimeout(1200); await page.keyboard.press('Escape').catch(() => {}); },
    },
    {
      narration:
        'Trong Cấu hình hệ thống, mỗi cán bộ có thể tùy chỉnh loại thông báo muốn nhận và kênh nhận, như trên ứng dụng hay qua thiết bị di động.',
      async run(page) { await page.goto('/settings', { waitUntil: 'domcontentloaded' }); await wait(page); await scrollTo(page, 200); },
    },
    {
      narration:
        'Mục Hồ sơ quá hạn tổng hợp các hồ sơ vượt thời hạn giải quyết, giúp lãnh đạo đôn đốc và xử lý kịp thời.',
      async run(page) { await page.goto('/settings/overdue-records', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
  ],
};
