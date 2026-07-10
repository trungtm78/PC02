/**
 * Clip 16 — Tạm đình chỉ & Phụ lục BCA.
 * Tour: báo cáo TĐC, Phụ lục 1-6, thống kê 48 trường.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '16-tdc-phu-luc',
  title: 'Tạm đình chỉ & Phụ lục BCA',
  role: 'admin',
  steps: [
    {
      narration:
        'Nhóm báo cáo chuyên ngành hỗ trợ nghiệp vụ theo mẫu của Bộ Công an. Trước hết là báo cáo Tạm đình chỉ.',
      async run(page) { await page.goto('/reports/tdac', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Báo cáo Tạm đình chỉ tổng hợp các hồ sơ tạm đình chỉ, hỗ trợ lập nháp, rà soát, phê duyệt và hoàn thiện theo quy trình.',
      async run(page) { await scrollTo(page, 0); await page.waitForTimeout(700); },
    },
    {
      narration:
        'Phụ lục 1 đến 6 là các biểu mẫu thống kê theo quy định, được hệ thống tổng hợp tự động từ dữ liệu hồ sơ.',
      async run(page) { await page.goto('/reports/phu-luc-1-6', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Biểu thống kê bốn mươi tám trường cung cấp bức tranh chi tiết về vụ án, phục vụ báo cáo và phân tích chuyên sâu.',
      async run(page) { await page.goto('/reports/stat48', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
  ],
};
