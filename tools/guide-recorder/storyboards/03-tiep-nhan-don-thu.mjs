/**
 * Clip 03 — Tiếp nhận đơn thư mới.
 * Điền form tạo đơn thư với dữ liệu mẫu và lưu (tạo bản ghi thật để minh hoạ trọn luồng).
 */
import { typeInto, selectFirstReal, pickFK, scrollTo, clickIfVisible } from '../lib/ui.mjs';

export default {
  slug: '03-tiep-nhan-don-thu',
  title: 'Tiếp nhận đơn thư mới',
  role: 'admin',
  steps: [
    {
      narration:
        'Đơn thư là điểm khởi đầu của mọi hồ sơ. Để tiếp nhận đơn mới, quý vị vào mục Đơn thư rồi chọn Tiếp nhận đơn mới.',
      async run(page) {
        await page.goto('/petitions/new', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(900);
      },
    },
    {
      narration:
        'Ngày tiếp nhận được điền sẵn là hôm nay. Tiếp theo, nhập họ tên và địa chỉ của người gửi đơn.',
      async run(page) {
        await typeInto(page, '[data-testid="field-senderName"]', 'Nguyễn Văn An');
        await typeInto(page, '[data-testid="field-senderAddress"]', 'Số 12 đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');
      },
    },
    {
      narration:
        'Nhập số điện thoại liên hệ của người gửi để tiện xác minh khi cần.',
      async run(page) {
        await typeInto(page, '[data-testid="field-senderPhone"]', '0901234567');
      },
    },
    {
      narration:
        'Chọn loại đơn thư — tố giác, tin báo, khiếu nại hay kiến nghị — và chọn tội danh chính có liên quan.',
      async run(page) {
        await selectFirstReal(page, '[data-testid="field-petitionType"]');
        await pickFK(page, 'field-crimeChinhId', { search: 'trộm' });
      },
    },
    {
      narration:
        'Nhập tóm tắt ngắn gọn và nội dung chi tiết của đơn để cán bộ xử lý nắm được bản chất vụ việc.',
      async run(page) {
        await scrollTo(page, 500);
        await typeInto(page, '[data-testid="field-summary"]', 'Tố giác hành vi trộm cắp tài sản tại khu dân cư', 25);
        await typeInto(page, '[data-testid="field-detailContent"]', 'Người dân trình báo bị mất xe máy để trước nhà vào đêm ngày 05 tháng 7, đề nghị cơ quan công an xác minh làm rõ.', 12);
      },
    },
    {
      narration:
        'Kiểm tra lại thông tin rồi bấm nút Lưu đơn thư. Hệ thống tự sinh số đơn theo định dạng chuẩn và chuyển về danh sách đơn thư.',
      async run(page) {
        await clickIfVisible(page, '[data-testid="btn-save-main"]');
        await page.waitForTimeout(700);
        // Nếu có xác nhận/summary modal thì bấm tiếp
        await clickIfVisible(page, '[data-testid="btn-confirm"], button:has-text("Xác nhận")', 2500);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1200);
      },
    },
  ],
};
