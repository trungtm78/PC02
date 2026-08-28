import { phienBanDangChay } from './phien-ban-dang-chay';

/**
 * Máy chủ phải nói được nó đang chạy bản nào.
 *
 * Ngày 28/08/2026 cán bộ dùng app của bản 23/08 suốt 5 ngày mà không ai biết: CDN giữ `sw.js`
 * cũ ở biên, service worker cũ tiếp tục phục vụ gói cũ từ kho nội bộ, và mọi tệp cũ vẫn còn
 * trên máy chủ nên app cũ chạy trơn tru. Deploy xanh, health ok, hỏng hoàn toàn im lặng.
 *
 * Giao diện KHÔNG tự biết mình cũ — nó chỉ có bản số nướng sẵn lúc dựng. Muốn biết thì phải
 * hỏi một nguồn KHÔNG BAO GIỜ bị cache: đường `/api/` (nginx chuyển tiếp, không cache; CDN
 * cũng không cache đường động). Nên bản số phải nằm ở đó.
 */
describe('Phiên bản đang chạy', () => {
  it('đọc được và không rỗng', () => {
    expect(phienBanDangChay()).toMatch(/\S/);
  });

  /** Dạng `x.y.z.w` như tệp VERSION của dự án — lệch dạng là giao diện so sai. */
  it('đúng dạng số hiệu của dự án', () => {
    expect(phienBanDangChay()).toMatch(/^\d+\.\d+\.\d+(\.\d+)?$/);
  });

  /**
   * Gọi nhiều lần phải ra cùng một giá trị. Đọc đĩa mỗi lần thì một lần lỗi đọc sẽ làm giao
   * diện tưởng máy chủ vừa đổi bản và tự tải lại — vòng lặp tải lại giữa giờ làm việc.
   */
  it('gọi nhiều lần ra cùng kết quả', () => {
    expect(phienBanDangChay()).toBe(phienBanDangChay());
  });
});

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * CỔNG: `/health` phải trả số hiệu bản đang chạy.
 *
 * Thiếu trường này thì giao diện không có cách nào biết mình cũ, và cả lớp lỗi "cán bộ dùng
 * bản cũ suốt nhiều ngày mà không ai biết" quay lại y nguyên.
 */
describe('GATE — /health trả số hiệu bản đang chạy', () => {
  const ctrl = new AppController(new AppService());

  it('có trường `version`', () => {
    expect(ctrl.health().version).toMatch(/^\d+\.\d+\.\d+(\.\d+)?$/);
  });

  it('vẫn giữ nguyên `status` và `timestamp` — bộ kiểm sống của deploy đọc chúng', () => {
    const r = ctrl.health();
    expect(r.status).toBe('ok');
    expect(new Date(r.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('`version` khớp hàm đọc phiên bản, không phải chuỗi cứng', () => {
    expect(ctrl.health().version).toBe(phienBanDangChay());
  });
});
