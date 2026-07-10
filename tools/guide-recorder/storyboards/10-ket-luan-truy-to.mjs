/**
 * Clip 10 — Kết luận điều tra → Truy tố → Xét xử → Lưu trữ.
 * Mở chi tiết vụ án, vào thẻ Kết luận điều tra; giới thiệu vòng đời trạng thái vụ án.
 */
import { apiGet, pickList } from '../lib/auth.mjs';
import { scrollTo } from '../lib/ui.mjs';

async function openTab(page, label) {
  const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
  if (await tab.count()) { await tab.click().catch(() => {}); }
  else { await page.getByText(new RegExp(label, 'i')).first().click().catch(() => {}); }
  await page.waitForTimeout(1200);
}

export default {
  slug: '10-ket-luan-truy-to',
  title: 'Kết luận điều tra → Truy tố → Xét xử',
  role: 'admin',
  steps: [
    {
      narration:
        'Kết thúc điều tra, cơ quan điều tra ban hành bản kết luận điều tra. Mở chi tiết vụ án và vào thẻ Kết luận điều tra.',
      async run(page) {
        const resp = await apiGet('/cases?limit=10');
        const list = pickList(resp);
        const id = list[0] ? list[0].id : null;
        await page.goto(id ? `/cases/${id}` : '/cases', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
        await openTab(page, 'Kết luận');
      },
    },
    {
      narration:
        'Cán bộ lập kết luận điều tra: chọn loại kết luận, ngày ban hành, người lập, người duyệt và nội dung. Bản kết luận có trạng thái dự thảo, chờ duyệt và đã duyệt.',
      async run(page) {
        await page.waitForTimeout(1000);
        await scrollTo(page, 200);
      },
    },
    {
      narration:
        'Vụ án được quản lý theo mười trạng thái: từ Tiếp nhận, Đang xác minh, Đang điều tra, tới Đã kết luận, Đang truy tố, Đang xét xử và cuối cùng là Đã lưu trữ.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(800);
      },
    },
    {
      narration:
        'Khi có căn cứ, vụ án có thể Tạm đình chỉ hoặc Đình chỉ. Mỗi lần đổi trạng thái đều được ghi vào lịch sử, bảo đảm truy vết toàn bộ quá trình tố tụng.',
      async run(page) {
        await scrollTo(page, 300);
        await page.waitForTimeout(700);
      },
    },
    {
      narration:
        'Sau khi hoàn tất truy tố và xét xử, hồ sơ vụ án được lưu trữ, khép lại vòng đời trưởng thành của dữ liệu từ đơn thư, qua vụ việc, tới vụ án.',
      async run(page) {
        await scrollTo(page, 0);
        await page.waitForTimeout(700);
      },
    },
  ],
};
