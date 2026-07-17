/**
 * Clip 08 — Khởi tố vụ án.
 * Tạo vụ án mới, nhấn mạnh trường Nguồn vụ án (caseProvenance) theo Điều 143 BLTTHS.
 * Ví dụ: CQĐT phát hiện trực tiếp. Tạo bản ghi thật.
 */
import { typeInto, selectEnum, pickFK, clickIfVisible, scrollTo, setValue } from '../lib/ui.mjs';

export default {
  slug: '08-khoi-to-vu-an',
  title: 'Khởi tố vụ án',
  role: 'admin',
  steps: [
    {
      narration:
        'Khi nguồn tin đủ căn cứ, cơ quan điều tra tiến hành khởi tố vụ án. Quý vị vào mục Quản lý vụ án rồi chọn Khởi tố vụ án mới.',
      async run(page) {
        await page.goto('/cases/new', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      },
    },
    {
      narration:
        'Trước hết, chọn Nguồn vụ án. Đây là trường bắt buộc theo Điều 143 Bộ luật Tố tụng hình sự: khởi tố từ đơn thư, từ vụ việc, do cơ quan điều tra phát hiện trực tiếp, hay ủy thác điều tra.',
      async run(page) {
        await selectEnum(page, '[data-testid="select-case-provenance"]', 'DIRECT_DISCOVERY');
        await page.waitForTimeout(500);
      },
    },
    {
      narration:
        'Ở đây chọn "Cơ quan điều tra phát hiện trực tiếp", hệ thống hiện ô ghi chú nguồn để mô tả căn cứ phát hiện.',
      async run(page) {
        await typeInto(page, '[data-testid="source-note-textarea"]', 'Qua công tác nghiệp vụ, trinh sát phát hiện dấu hiệu tội phạm và đề xuất khởi tố.', 12);
      },
    },
    {
      narration:
        'Nhập tiêu đề hồ sơ vụ án và chọn điều tra viên chính thụ lý.',
      async run(page) {
        await typeInto(page, '[data-testid="input-case-title"]', 'Vụ án trộm cắp tài sản xảy ra tại Quận 1');
        await pickFK(page, 'fk-handler', {});
      },
    },
    {
      narration:
        'Bấm Lưu hồ sơ. Hệ thống hiển thị bảng tóm tắt để rà soát lần cuối trước khi tạo. Xác nhận để hoàn tất khởi tố; vụ án nhận mã và bắt đầu quy trình điều tra.',
      async run(page) {
        await scrollTo(page, 0);
        await clickIfVisible(page, '[data-testid="btn-save"], [data-testid="btn-save-main"]');
        await page.waitForTimeout(900);
        // PreSaveSummaryModal xác nhận
        await clickIfVisible(page, 'button:has-text("Xác nhận"), button:has-text("Đồng ý"), button:has-text("Tạo hồ sơ")', 3000);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1500);
      },
    },
  ],
};
