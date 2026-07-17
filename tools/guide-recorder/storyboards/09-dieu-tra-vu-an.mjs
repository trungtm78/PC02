/**
 * Clip 09 — Điều tra vụ án.
 * Mở chi tiết 1 vụ án, giới thiệu các tab: đối tượng/bị can, luật sư, vật chứng, tiến trình.
 */
import { apiGet, pickList } from '../lib/auth.mjs';
import { clickIfVisible, scrollTo } from '../lib/ui.mjs';

async function openTab(page, label) {
  const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
  if (await tab.count()) { await tab.click().catch(() => {}); }
  else { await page.getByText(new RegExp(label, 'i')).first().click().catch(() => {}); }
  await page.waitForTimeout(1200);
}

export default {
  slug: '09-dieu-tra-vu-an',
  title: 'Điều tra vụ án',
  role: 'admin',
  steps: [
    {
      narration:
        'Sau khi khởi tố, vụ án bước vào giai đoạn điều tra. Mở chi tiết một vụ án để quản lý toàn bộ hồ sơ.',
      async run(page) {
        const resp = await apiGet('/cases?limit=10');
        const list = pickList(resp);
        const id = list[0] ? list[0].id : null;
        await page.goto(id ? `/cases/${id}` : '/cases', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
    {
      narration:
        'Màn hình chi tiết vụ án chia thành các thẻ: thông tin chung, bị can, luật sư, tiến trình điều tra, kết luận và hành trình hồ sơ.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(700);
      },
    },
    {
      narration:
        'Tại thẻ Bị can, cán bộ thêm và quản lý các đối tượng: bị can, bị hại và người làm chứng, kèm nhân thân, căn cước, tình trạng giam giữ và tội danh.',
      async run(page) {
        await openTab(page, 'Bị can');
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Thẻ Luật sư quản lý người bào chữa tham gia vụ án, gắn với từng bị can theo quy định.',
      async run(page) {
        await openTab(page, 'Luật sư');
        await page.waitForTimeout(600);
      },
    },
    {
      narration:
        'Toàn bộ vật chứng, tài liệu và diễn biến điều tra đều được ghi nhận, giúp hồ sơ đầy đủ và minh bạch phục vụ kết luận điều tra.',
      async run(page) {
        await openTab(page, 'Tiến trình');
        await page.waitForTimeout(600);
      },
    },
  ],
};
