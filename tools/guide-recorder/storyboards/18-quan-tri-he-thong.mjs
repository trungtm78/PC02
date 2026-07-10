/**
 * Clip 18 — Quản trị hệ thống.
 * Tour: danh mục tra cứu, quy tắc thời hạn (maker/checker), khôi phục & di trú dữ liệu.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '18-quan-tri-he-thong',
  title: 'Quản trị hệ thống',
  role: 'admin',
  steps: [
    {
      narration:
        'Để hệ thống vận hành đúng nghiệp vụ, quản trị viên cấu hình các danh mục nền. Mục Danh mục tra cứu quản lý tội danh, đơn vị, loại chứng từ và nhiều danh mục khác.',
      async run(page) { await page.goto('/danh-muc', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Mục Quy tắc thời hạn cấu hình thời hạn xử lý theo Bộ luật Tố tụng hình sự. Việc thay đổi áp dụng cơ chế đề xuất và phê duyệt, tách bạch người lập và người duyệt.',
      async run(page) { await page.goto('/admin/deadline-rules', { waitUntil: 'domcontentloaded' }); await wait(page); await scrollTo(page, 0); },
    },
    {
      narration:
        'Mục Khôi phục dữ liệu cho phép phục hồi các bản ghi đã xóa mềm, phòng ngừa mất mát thông tin.',
      async run(page) { await page.goto('/admin/khoi-phuc', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Cuối cùng, mục Di trú dữ liệu hỗ trợ nhập và chuẩn hóa dữ liệu từ hệ thống cũ, bảo đảm kế thừa đầy đủ khi chuyển đổi.',
      async run(page) { await page.goto('/admin/di-tru-du-lieu', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
  ],
};
