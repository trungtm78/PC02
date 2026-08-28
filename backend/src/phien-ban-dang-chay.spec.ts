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

import * as fsMod from 'fs';
import { maBanDung } from './phien-ban-dang-chay';

/**
 * CỔNG: thứ giao diện dùng để dò "mình có đang chạy bản cũ không" phải ĐỔI MỖI LẦN DEPLOY.
 *
 * Bản đầu so `version` — đọc tệp `VERSION`, mà tệp ấy chỉ tăng khi PHÁT HÀNH: lần cuối
 * v0.72.0.0, còn từ đó tới 28/08/2026 đã ship hơn 40 PR mà số không đổi. So nó là so một thứ
 * đứng yên, và cả cơ chế tự báo thành ra trang trí. Suýt lọt lên máy thật.
 */
describe('GATE — mã bản dựng đổi mỗi lần deploy', () => {
  it('/health trả cả `version` lẫn `buildId`', () => {
    const r = new AppController(new AppService()).health();
    expect(typeof r.version).toBe('string');
    expect(typeof r.buildId).toBe('string');
    expect(r.buildId.length).toBeGreaterThan(0);
  });

  it('`buildId` khớp hàm đọc mã bản dựng, không phải chuỗi cứng', () => {
    expect(new AppController(new AppService()).health().buildId).toBe(maBanDung());
  });

  /**
   * Không có tệp `BUILD_ID` (chạy ở máy lập trình viên, hoặc bản deploy cũ) thì rơi về số phát
   * hành — lúc ấy hai bên trùng nhau nên KHÔNG báo nhầm cho cán bộ.
   */
  it('thiếu tệp BUILD_ID thì rơi về số phát hành, không rỗng', () => {
    expect(maBanDung()).toMatch(/\S/);
  });

  /** Đọc một lần rồi nhớ: đọc mỗi lượt gọi thì một lần lỗi đọc làm giao diện tưởng vừa deploy. */
  it('gọi nhiều lần ra cùng kết quả', () => {
    expect(maBanDung()).toBe(maBanDung());
  });

  /**
   * Cổng chống tái diễn: `deploy.sh` PHẢI ghi tệp `BUILD_ID`. Thiếu dòng ấy thì máy chủ mãi
   * trả số phát hành, hai bên luôn trùng, và dải báo không bao giờ hiện — hỏng im lặng y như
   * lỗi gốc.
   */
  it('deploy.sh có ghi tệp BUILD_ID', () => {
    const sh = fsMod.readFileSync(
      require('path').resolve(__dirname, '..', '..', 'scripts', 'deploy', 'deploy.sh'),
      'utf-8',
    );
    expect(sh.includes('> "$NEW_DIR/BUILD_ID"')).toBe(true);
  });

  /** Và CI phải truyền mã commit vào bản dựng giao diện, nếu không gói mang số đứng yên. */
  it('CI truyền BUILD_ID vào bản dựng giao diện', () => {
    const yml = fsMod.readFileSync(
      require('path').resolve(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
      'utf-8',
    );
    expect(yml.includes('BUILD_ID: ${{ github.sha }}')).toBe(true);
  });
});
