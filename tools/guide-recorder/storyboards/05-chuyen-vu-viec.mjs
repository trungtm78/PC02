/**
 * Clip 05 — Chuyển đơn thư thành vụ việc.
 * Mở 1 đơn thư chưa liên kết ở chế độ sửa → nút Chuyển đổi → chọn Vụ việc → điền → xác nhận.
 * Lấy ID đơn thư khả dụng qua API.
 */
import { apiGet, pickList } from '../lib/auth.mjs';
import { typeInto, clickIfVisible } from '../lib/ui.mjs';

export default {
  slug: '05-chuyen-vu-viec',
  title: 'Chuyển đơn thư thành vụ việc',
  role: 'admin',
  steps: [
    {
      narration:
        'Khi đơn thư đủ điều kiện, quý vị chuyển đơn thành vụ việc để tiến hành xác minh. Mở đơn cần chuyển ở chế độ chỉnh sửa.',
      async run(page) {
        // tìm đơn chưa liên kết incident/case
        const resp = await apiGet('/petitions?limit=30');
        const list = pickList(resp);
        const p = list.find((x) => !x.linkedIncidentId && !x.linkedCaseId) || list[0];
        page.__petitionId = p ? p.id : null;
        if (page.__petitionId) {
          await page.goto(`/petitions/${page.__petitionId}/edit`, { waitUntil: 'domcontentloaded' });
        } else {
          await page.goto('/petitions', { waitUntil: 'domcontentloaded' });
        }
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
    {
      narration:
        'Bấm nút Chuyển đổi. Hệ thống hỏi quý vị muốn chuyển đơn thành Vụ việc hay khởi tố thẳng thành Vụ án.',
      async run(page) {
        await clickIfVisible(page, '[data-testid="btn-convert-petition"]', 4000);
        await page.waitForTimeout(800);
      },
    },
    {
      narration:
        'Chọn Vụ việc. Đây là hướng xử lý phổ biến khi cần xác minh, làm rõ nguồn tin trước khi quyết định khởi tố.',
      async run(page) {
        await clickIfVisible(page, '[data-testid="convert-option-incident"]', 3000);
        await page.waitForTimeout(700);
      },
    },
    {
      narration:
        'Nhập tên vụ việc và loại vụ việc. Các thông tin của đơn thư sẽ được kế thừa sang hồ sơ vụ việc mới.',
      async run(page) {
        await typeInto(page, '[data-testid="convert-incident-name"]', 'Xác minh nguồn tin từ đơn tố giác');
        await typeInto(page, '[data-testid="convert-incident-type"]', 'Tố giác tội phạm');
      },
    },
    {
      narration:
        'Bấm Chuyển thành Vụ việc. Hệ thống tạo vụ việc mới, gán mã, và liên kết ngược về đơn thư gốc để bảo đảm truy vết.',
      async run(page) {
        await clickIfVisible(page, '[data-testid="convert-submit"]', 3000);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1500);
      },
    },
  ],
};
