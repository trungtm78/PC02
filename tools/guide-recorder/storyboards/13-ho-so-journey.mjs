/**
 * Clip 13 — Tài liệu & Hành trình hồ sơ.
 * Tour: tài liệu đính kèm, hành trình hồ sơ theo dòng thời gian.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '13-ho-so-journey',
  title: 'Tài liệu & Hành trình hồ sơ',
  role: 'admin',
  steps: [
    {
      narration:
        'Mỗi hồ sơ đều có tài liệu đính kèm. Mục Tài liệu hồ sơ tập hợp các văn bản, chứng từ liên quan để tra cứu nhanh.',
      async run(page) { await page.goto('/documents', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Điểm nổi bật của hệ thống là Hành trình hồ sơ: toàn bộ quá trình xử lý được ghi lại theo dòng thời gian.',
      async run(page) { await page.goto('/ho-so-journey', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Từ khi tiếp nhận đơn thư, chuyển thành vụ việc, khởi tố vụ án, tới các mốc điều tra và kết luận, mỗi sự kiện đều hiển thị rõ thời điểm và người thực hiện.',
      async run(page) { await scrollTo(page, 300); await page.waitForTimeout(700); await scrollTo(page, 600); },
    },
    {
      narration:
        'Nhờ đó, lãnh đạo và cán bộ dễ dàng nắm được lịch sử đầy đủ của một hồ sơ, phục vụ kiểm tra, giám sát và báo cáo.',
      async run(page) { await scrollTo(page, 0); await page.waitForTimeout(700); },
    },
  ],
};
