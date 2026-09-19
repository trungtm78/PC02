import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: `deploy.sh` phải KIỂM cột bóng tìm kiếm sau khi migration chạy.
 *
 * Migration tìm kiếm chỉ TẠO cột bóng `<cot>_bd` và trigger; dữ liệu CŨ vẫn NULL cho tới khi có
 * người nhớ chạy CLI nạp bằng tay. Cột bóng NULL không làm cán bộ mất kết quả — nhánh lùi về cột
 * gốc vẫn trả đúng — nhưng truy vấn không dùng được chỉ mục GIN nên chậm hơn hẳn, và KHÔNG AI
 * ĐƯỢC BÁO. Đúng lớp hỏng im lặng mà chính `deploy.sh` đã ba lần tự cảnh báo trong chú thích
 * (service worker bị cache, bộ canh cache cũ, bản công khai lệch).
 *
 * Cổng này KHÔNG đòi deploy tự nạp. Nạp thật đo trên prod 16/09/2026 mất rất lâu vì CLI quét lại
 * cả bảng cũ; nhét vào deploy là chặn cả lượt triển khai và chặn khởi động lại dịch vụ. Đòi đúng
 * thứ `deploy.sh` vẫn làm với bộ canh cache: chạy bản CHẠY THỬ (không ghi gì), lệch thì báo to
 * kèm đúng lệnh phải chạy, rồi kết thúc ĐỎ sau khi mã đã lên và qua health.
 */
const DEPLOY_SH = path.resolve(__dirname, '../../scripts/deploy/deploy.sh');

function docDeploy(): string {
  return fs.readFileSync(DEPLOY_SH, 'utf8');
}

describe('GATE — deploy.sh kiểm cột bóng tìm kiếm sau migration', () => {
  it('tệp deploy.sh đọc được', () => {
    expect(docDeploy()).toMatch(/\S/);
  });

  it('có gọi CLI nạp cột bóng', () => {
    expect(docDeploy()).toContain('nap-cot-bong-tim-kiem');
  });

  /**
   * Chỉ soi dòng THỰC THI. Dòng `log` in lệnh hướng dẫn chạy tay BẮT BUỘC chứa `--that` — đó là
   * cả mục đích của khối cảnh báo. Bản đầu của ca kiểm này cấm `--that` trên mọi dòng, nên nó ép
   * viết thông điệp vòng vo chỉ để lách chính nó.
   */
  it('gọi ở chế độ CHẠY THỬ — deploy không được tự ghi dữ liệu', () => {
    const src = docDeploy();
    const dong = src
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.includes('nap-cot-bong-tim-kiem') &&
          !l.startsWith('#') &&
          !l.startsWith('log '),
      );
    expect(dong.length).toBeGreaterThan(0);
    for (const l of dong) expect(l).not.toContain('--that');
  });

  /**
   * Bản đầu gọi CLI không cờ (chạy thử): thoát 0 dù còn dòng chưa nạp → `if ! node …` không bao giờ
   * bật cờ, cảnh báo câm. Phải gọi chế độ `--kiem` — chế độ duy nhất thoát khác 0 khi còn dòng chưa nạp.
   */
  it('gọi đúng chế độ --kiem (thoát khác 0 khi còn dòng chưa nạp)', () => {
    const dong = docDeploy()
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.includes('nap-cot-bong-tim-kiem') &&
          !l.startsWith('#') &&
          !l.startsWith('log '),
      );
    expect(dong.length).toBeGreaterThan(0);
    for (const l of dong) expect(l).toContain('--kiem');
  });

  it('lệch thì báo kèm đúng lệnh phải chạy tay (có --that)', () => {
    expect(docDeploy()).toContain('--that');
  });

  it('chạy SAU khi migration đã áp — kiểm trước migration là luôn thấy lệch', () => {
    const src = docDeploy();
    expect(src.indexOf('prisma migrate deploy')).toBeLessThan(
      src.indexOf('nap-cot-bong-tim-kiem'),
    );
  });

  it('không chặn giữa chừng: kiểm SAU health check, theo đúng khuôn bộ canh cache', () => {
    const src = docDeploy();
    expect(src.indexOf('health-check.sh')).toBeLessThan(
      src.indexOf('nap-cot-bong-tim-kiem'),
    );
  });

  /**
   * Rà độc lập 19/09/2026: gộp mọi mã khác 0 thành "chưa nạp" thì lỗi chạy (thiếu dist, sai mật khẩu CSDL)
   * cũng in lời khuyên chạy `--that` — dẫn sai hướng. Mã 2 = lệch thật; mã khác = lỗi chạy, thông điệp riêng.
   */
  it('phân biệt mã 2 (lệch) với lỗi chạy, mỗi loại một cờ và một thông điệp', () => {
    const src = docDeploy();
    expect(src).toContain(
      'nap-cot-bong-tim-kiem.js --kiem || KIEM_COT_BONG=$?',
    );
    expect(src).toContain('if [ "$KIEM_COT_BONG" = "2" ]; then');
    expect(src).toContain('COT_BONG_LOI=1');
    const khoiDo = src.slice(
      src.lastIndexOf('if [ "${CANH_LECH:-0}" = "1" ] ||'),
    );
    expect(khoiDo).toContain('COT_BONG_LECH');
    expect(khoiDo).toContain('COT_BONG_LOI');
  });

  /**
   * Rà độc lập 19/09/2026 đề xuất dời báo đỏ xuống SAU bước dọn để khỏi để rác — KHÔNG làm: sau khi sửa tay,
   * người vận hành chạy lại chính bản ấy, và xoá tarball trước là lần chạy lại chết ngay vì "không thấy gói"
   * (cùng luật `cong-service-worker.spec.ts`). Cờ cột bóng đi chung khối báo đỏ ấy nên hưởng cùng thứ tự.
   */
  it('báo đỏ TRƯỚC khi xoá tarball — để còn chạy lại được chính bản ấy', () => {
    const src = docDeploy();
    const bao = src.indexOf('Mã ĐÃ lên máy');
    expect(bao).toBeGreaterThan(src.indexOf('nap-cot-bong-tim-kiem.js --kiem'));
    expect(bao).toBeLessThan(src.indexOf('rm -f "$TARBALL"'));
  });
});
