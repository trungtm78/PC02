/**
 * Clip 04 — Xử lý đơn thư.
 * Tour: danh sách đơn thư, menu thao tác trên hàng, hướng dẫn nghiệp vụ, đơn trùng lặp.
 */
import { clickIfVisible, scrollTo } from '../lib/ui.mjs';

export default {
  slug: '04-xu-ly-don-thu',
  title: 'Xử lý đơn thư',
  role: 'admin',
  steps: [
    {
      narration:
        'Sau khi tiếp nhận, đơn thư được đưa vào danh sách để xử lý. Màn hình danh sách cho phép lọc theo trạng thái và tìm kiếm nhanh.',
      async run(page) {
        await page.goto('/petitions', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      },
    },
    {
      narration:
        'Các thẻ trạng thái phía trên phân loại đơn: mới tiếp nhận, đang xử lý, chờ duyệt, đã lưu đơn, đã giải quyết, đã chuyển vụ việc hoặc vụ án.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Trên mỗi đơn có nút thao tác, mở ra các lựa chọn: chuyển thành vụ việc, chuyển thành vụ án, hướng dẫn, hoặc lưu đơn.',
      async run(page) {
        const menu = page.locator('[data-testid^="btn-action-menu"]').first();
        try {
          await menu.scrollIntoViewIfNeeded();
          await menu.click({ timeout: 3000 });
          await page.waitForTimeout(1500);
        } catch (_e) {}
        await page.waitForTimeout(1400);
        await page.keyboard.press('Escape').catch(() => {});
      },
    },
    {
      narration:
        'Với đơn cần định hướng, cán bộ lập phiếu hướng dẫn nghiệp vụ để công dân bổ sung hoặc thực hiện đúng thủ tục.',
      async run(page) {
        await page.goto('/guidance', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
    {
      narration:
        'Hệ thống còn hỗ trợ phát hiện đơn trùng lặp, giúp gộp các đơn cùng nội dung, tránh xử lý chồng chéo.',
      async run(page) {
        await page.goto('/classification/duplicates', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
  ],
};
