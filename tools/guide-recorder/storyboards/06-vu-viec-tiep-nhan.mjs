/**
 * Clip 06 — Tiếp nhận & phân công vụ việc.
 * Tạo vụ việc mới (nguồn tin), giới thiệu 4 giai đoạn BCA. Tạo bản ghi thật.
 */
import { typeInto, pickFK, clickIfVisible, scrollTo } from '../lib/ui.mjs';

export default {
  slug: '06-vu-viec-tiep-nhan',
  title: 'Tiếp nhận & phân công vụ việc',
  role: 'admin',
  steps: [
    {
      narration:
        'Vụ việc, hay nguồn tin về tội phạm, là bước tiếp theo trong vòng đời hồ sơ. Quý vị vào mục Vụ việc rồi chọn Thêm vụ việc mới.',
      async run(page) {
        await page.goto('/vu-viec/new', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(900);
      },
    },
    {
      narration:
        'Nhập tên vụ việc mô tả ngắn gọn bản chất của nguồn tin. Đây là thông tin bắt buộc.',
      async run(page) {
        await typeInto(page, '[data-testid="field-name"]', 'Xác minh nguồn tin trộm cắp tài sản tại phường Bến Thành');
      },
    },
    {
      narration:
        'Khai báo loại vụ việc, loại nguồn tin theo Điều 144, và tóm tắt nội dung. Các trường này giúp phân loại và xử lý đúng quy trình.',
      async run(page) {
        await pickFK(page, 'field-incidentType', {});
        await typeInto(page, '[data-testid="field-description"]', 'Tiếp nhận tin báo của quần chúng về vụ trộm cắp tài sản, cần xác minh làm rõ.', 12);
      },
    },
    {
      narration:
        'Vụ việc được quản lý theo bốn giai đoạn của Bộ Công an: Tiếp nhận và phân loại, Xác minh và giải quyết, Kết quả, và Tạm đình chỉ, phục hồi. Mỗi giai đoạn tương ứng nhóm trường thông tin riêng.',
      async run(page) {
        await scrollTo(page, 360);
        await page.waitForTimeout(600);
        await scrollTo(page, 720);
      },
    },
    {
      narration:
        'Sau khi nhập xong, bấm Lưu vụ việc. Hệ thống sinh mã vụ việc và tự tính thời hạn giải quyết theo quy định của Bộ luật Tố tụng hình sự.',
      async run(page) {
        await scrollTo(page, 0);
        await clickIfVisible(page, '[data-testid="btn-save"], [data-testid="btn-save-main"]');
        await page.waitForTimeout(700);
        await clickIfVisible(page, 'button:has-text("Xác nhận")', 2500);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
  ],
};
