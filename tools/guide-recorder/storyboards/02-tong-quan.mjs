/**
 * Clip 02 — Màn hình Tổng quan & Điều hướng.
 * Guided tour: bảng chỉ số, thanh điều hướng theo nghiệp vụ, tìm kiếm, thông báo.
 * Chỉ điều hướng/xem — không tạo dữ liệu.
 */

async function scrollTo(page, y) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y);
  await page.waitForTimeout(500);
}

export default {
  slug: '02-tong-quan',
  title: 'Màn hình Tổng quan & Điều hướng',
  role: 'admin',
  steps: [
    {
      narration:
        'Sau khi đăng nhập, quý vị vào màn hình Tổng quan. Đây là nơi nắm nhanh tình hình xử lý hồ sơ của đơn vị.',
      async run(page) {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(900);
      },
    },
    {
      narration:
        'Hàng thẻ chỉ số phía trên cho biết tổng số hồ sơ, số hồ sơ mới tiếp nhận, số hồ sơ quá hạn cần chú ý, và số hồ sơ đã xử lý xong.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Bên dưới là các thống kê tổng vụ việc, tổng đơn thư cùng biểu đồ diễn biến theo thời gian, giúp lãnh đạo theo dõi khối lượng công việc.',
      async run(page) {
        await scrollTo(page, 360);
      },
    },
    {
      narration:
        'Thanh điều hướng bên trái được sắp xếp đúng theo trình tự xử lý hồ sơ: từ Đơn thư, tới Vụ việc, rồi Vụ án, sau đó là báo cáo và quản trị. Mỗi nhóm có thể mở rộng hoặc thu gọn.',
      async run(page) {
        await scrollTo(page, 0);
        await page.mouse.move(150, 300);
        await page.waitForTimeout(400);
        await page.mouse.move(150, 460);
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Ô tìm kiếm toàn cục trên cùng cho phép tra nhanh vụ án, đối tượng hay hồ sơ chỉ bằng vài từ khoá.',
      async run(page) {
        const search = page.getByPlaceholder(/Tìm.*vụ án|Tìm.*hồ sơ|Tìm kiếm/i).first();
        if (await search.isVisible().catch(() => false)) {
          await search.click();
          await search.pressSequentially('trộm cắp', { delay: 70 });
          await page.waitForTimeout(1200);
          await page.keyboard.press('Escape').catch(() => {});
        }
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Biểu tượng chuông thông báo hiển thị số việc cần xử lý. Bấm vào để xem các thông báo mới nhất như phân công, nhắc hạn hay thay đổi trạng thái hồ sơ.',
      async run(page) {
        const bell = page.locator('header button, [class*="notification" i] button, button[aria-label*="thông báo" i]').first();
        try {
          await bell.click({ timeout: 3000 });
          await page.waitForTimeout(1500);
          await page.keyboard.press('Escape').catch(() => {});
        } catch (_e) {}
        await page.waitForTimeout(400);
      },
    },
    {
      narration:
        'Như vậy, màn hình Tổng quan là điểm khởi đầu để quý vị nắm bắt công việc và truy cập nhanh mọi nghiệp vụ trong hệ thống.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(500);
      },
    },
  ],
};
