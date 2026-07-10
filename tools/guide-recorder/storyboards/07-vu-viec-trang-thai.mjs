/**
 * Clip 07 — Trạng thái & xử lý vụ việc.
 * Tour: menu thao tác trên hàng vụ việc — chuyển trạng thái, phân công, khởi tố;
 * giới thiệu 15 trạng thái và tạm đình chỉ/phục hồi.
 */
import { clickIfVisible, scrollTo } from '../lib/ui.mjs';

export default {
  slug: '07-vu-viec-trang-thai',
  title: 'Trạng thái & xử lý vụ việc',
  role: 'admin',
  steps: [
    {
      narration:
        'Vụ việc trải qua nhiều trạng thái trong quá trình xác minh. Danh sách vụ việc cho phép lọc theo bốn giai đoạn và theo dõi tiến độ.',
      async run(page) {
        await page.goto('/vu-viec', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      },
    },
    {
      narration:
        'Hệ thống quản lý mười lăm trạng thái vụ việc, từ Tiếp nhận, Đang xác minh, Đã phân công, tới Đã giải quyết, Tạm đình chỉ, Không khởi tố hay Đã chuyển vụ án. Việc chuyển trạng thái tuân theo quy tắc hợp lệ được kiểm soát tự động.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(700);
      },
    },
    {
      narration:
        'Trên mỗi vụ việc, bấm nút thao tác để mở các chức năng: phân công điều tra viên, chuyển trạng thái, hoặc khởi tố thành vụ án.',
      async run(page) {
        const menu = page.locator('[data-testid^="btn-action-menu"]').first();
        try {
          await menu.scrollIntoViewIfNeeded();
          await menu.click({ timeout: 3000 });
          await page.waitForTimeout(1600);
        } catch (_e) {}
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Chức năng Chuyển trạng thái chỉ cho phép chọn các trạng thái đích hợp lệ, kèm ghi chú lý do, bảo đảm đúng trình tự tố tụng.',
      async run(page) {
        const menu = page.locator('[data-testid^="btn-action-menu"]').first();
        try { await menu.click({ timeout: 3000 }); await page.waitForTimeout(700); } catch (_e) {}
        await clickIfVisible(page, '[data-testid^="btn-transition"]', 2500);
        await page.waitForTimeout(1500);
        await clickIfVisible(page, '[data-testid="btn-cancel-transition"]', 2000);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Với vụ việc chưa đủ căn cứ, có thể Tạm đình chỉ và Phục hồi khi có tình tiết mới, giúp quản lý chặt chẽ thời hiệu và tiến độ.',
      async run(page) {
        await scrollTo(page, 200);
        await page.waitForTimeout(700);
      },
    },
  ],
};
