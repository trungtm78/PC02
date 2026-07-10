/**
 * Clip 11 — Ủy thác, trao đổi & đề xuất VKS.
 * Tour: ủy thác điều tra, trao đổi vụ án, đề xuất Viện kiểm sát.
 */
import { scrollTo } from '../lib/ui.mjs';
const wait = async (page) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1100); };

export default {
  slug: '11-uy-thac-trao-doi-vks',
  title: 'Ủy thác, trao đổi & đề xuất VKS',
  role: 'admin',
  steps: [
    {
      narration:
        'Trong quá trình điều tra, có những việc cần phối hợp với đơn vị khác. Mục Ủy thác điều tra quản lý các yêu cầu ủy thác theo Điều 171 Bộ luật Tố tụng hình sự.',
      async run(page) { await page.goto('/uy-thac-dieu-tra', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Tại đây, cơ quan điều tra lập yêu cầu ủy thác cho cơ quan khác thực hiện một số hoạt động điều tra, kèm số quyết định, đơn vị giao và thời hạn ủy thác.',
      async run(page) { await scrollTo(page, 0); await page.waitForTimeout(700); },
    },
    {
      narration:
        'Mục Trao đổi vụ án phục vụ trao đổi thông tin, phối hợp xử lý giữa các đơn vị khi vụ án có liên quan nhiều nơi.',
      async run(page) { await page.goto('/case-exchange', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
    {
      narration:
        'Khi kết thúc điều tra, cơ quan điều tra lập đề xuất gửi Viện kiểm sát. Mục Đề xuất VKS giúp soạn, theo dõi và quản lý các đề xuất này.',
      async run(page) { await page.goto('/prosecutor-proposal', { waitUntil: 'domcontentloaded' }); await wait(page); },
    },
  ],
};
