/**
 * Clip 12 — In chứng từ & mẫu biểu.
 * Tour: tài liệu hồ sơ, mẫu chứng từ động, mã số chứng từ.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '12-in-chung-tu',
  title: 'In chứng từ & mẫu biểu',
  role: 'admin',
  steps: [
    {
      narration:
        'Hệ thống hỗ trợ in chứng từ động: từ dữ liệu hồ sơ, tự động điền vào mẫu biểu chuẩn. Trước tiên, xem mục Mẫu chứng từ trong nhóm Hệ thống.',
      async run(page) { await page.goto('/settings/document-templates', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Quản trị viên khai báo các mẫu chứng từ bằng cách tải lên tệp Word có chứa biến. Khi in, hệ thống thay biến bằng dữ liệu thật của hồ sơ.',
      async run(page) { await scrollTo(page, 0); await page.waitForTimeout(700); },
    },
    {
      narration:
        'Mục Mã số chứng từ cấu hình quy tắc sinh số tự động cho từng loại chứng từ, bảo đảm đánh số thống nhất, không trùng lặp.',
      async run(page) { await page.goto('/settings/document-numbers', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Trong từng hồ sơ đơn thư, vụ việc hay vụ án, cán bộ chỉ cần bấm In chứng từ, chọn mẫu, hệ thống báo các thông tin còn thiếu và xuất văn bản hoàn chỉnh.',
      async run(page) { await page.goto('/documents', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
  ],
};
