import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Cổng nằm ở bộ kiểm backend chứ không phải frontend: Vite chặn nạp tệp ngoài thư mục gốc của
 * nó, mà ba tệp cần soi nằm ở `scripts/deploy/`. Đây cũng là chỗ `phien-ban-dang-chay.spec.ts`
 * đã soi `deploy.sh` và `deploy.yml` — cùng một loại việc, để cùng một chỗ.
 */
const GOC = resolve(__dirname, '..', '..');
const doc = (p: string): string => readFileSync(resolve(GOC, p), 'utf8');

const viteConfig = doc('frontend/vite.config.ts');
const nginxVang = doc('scripts/deploy/nginx-pc02.conf');
const kichBanCai = doc('scripts/deploy/install-nginx-cache-guard.sh');
const kiemBanCongKhai = doc('scripts/deploy/kiem-ban-cong-khai.sh');
const biaMo = doc('frontend/public/sw.js');

/**
 * Cổng chặn cho service worker: tên tệp, luật đệm, và bia mộ tự gỡ.
 *
 * ── Vì sao ──
 *
 * Ngày 23/08/2026 `/sw.js` được phục vụ kèm `Cache-Control: immutable, max-age=30d`. Cloudflare
 * ghim đúng bản ấy ở biên, và service worker bị ghim tự phục vụ `index.html` từ kho riêng cho
 * MỌI lần điều hướng — nên máy đã dính không bao giờ nạp mã mới, và không tự thoát được: trình
 * duyệt có dò bản mới, nhưng nó dò đúng `/sw.js` và lại nhận đúng bãi bytes đang bị ghim.
 *
 * Đổi tên sang `sw-v2.js` cứu được máy mới và máy tải lại cứng. Nhưng nó KHÔNG cứu máy đang bị
 * bản cũ điều khiển — trình duyệt của họ chẳng có lý do gì đi hỏi một địa chỉ chưa từng nghe
 * tên. Đường duy nhất tới họ vẫn là `/sw.js`, nên `/sw.js` phải trở thành **bia mộ**: một
 * service worker rỗng, không chặn điều hướng, tự xoá sạch kho rồi tự gỡ đăng ký mình.
 *
 * ── Vì sao cần cổng chặn thay vì chỉ sửa ──
 *
 * Lỗi này không phát ra tiếng. Triển khai vẫn xanh, health vẫn ok, ca kiểm vẫn xanh — chỉ có
 * cán bộ là ngồi trước bản của sáu ngày trước. Ba tệp cấu hình ở ba nơi (kịch bản cài, bộ kiểm
 * bản công khai, cấu hình vàng) phải nhất quán, và lần trước lệch nhau chính là cách nó lọt.
 */
describe('Cổng service worker', () => {
  it('vite sinh service worker dưới tên sw-v2.js', () => {
    expect(viteConfig).toContain("filename: 'sw-v2.js'");
  });

  /**
   * Cấu hình vàng là thứ máy chủ dựng mới đọc. Bỏ sót nó nghĩa là bất kỳ máy nào dựng lại từ
   * đầu sẽ tái tạo y nguyên sự cố — chỉ chậm hơn vài tháng nên càng khó lần ra.
   */
  it.each([
    ['cấu hình vàng', nginxVang],
    ['kịch bản cài bộ canh', kichBanCai],
  ])('%s đặt no-cache cho CẢ sw.js lẫn sw-v2.js', (_ten, noiDung) => {
    const khoi = /location\s+~\*?\s*\^\/sw\(-v\[0-9\]\+\)\?\\.js\$/.test(noiDung);
    // Phải khớp bằng MẪU phủ cả tên cũ lẫn mọi lần đổi tên sau, không phải khớp đúng một tên.
    expect(khoi).toBe(true);
    expect(noiDung).toContain('no-cache, must-revalidate');
  });

  /**
   * Phải soi CẢ HAI. `/sw-v2.js` là tên mới nên bao giờ cũng khớp — chưa ai kịp ghim nó; soi
   * mỗi nó thì đúng cảnh cần bắt (biên còn phục vụ bản cũ ở `/sw.js`) lại lọt qua trong im
   * lặng. `/sw.js` mới là địa chỉ duy nhất máy đang kẹt còn dò tới.
   */
  it.each([
    ['bộ kiểm bản công khai', kiemBanCongKhai],
    ['kịch bản cài bộ canh', kichBanCai],
  ])('%s soi CẢ bia mộ lẫn bản đang chạy', (_ten, kichBan) => {
    // MỌI vòng kiểm trong kịch bản, không chỉ vòng đầu: lỗi này vừa lặp lại y hệt ở vòng thứ
    // hai của kịch bản cài, nên cổng phải quét hết chứ đừng bắt mẫu đầu tiên rồi thôi.
    const vong = kichBan.match(/^[ 	]*for +[A-Za-z_]+ +in +\/.*$/gm) ?? [];
    expect(vong.length).toBeGreaterThan(0);
    for (const d of vong) {
      expect(d).toContain('/sw.js');
      expect(d).toContain('/sw-v2.js');
    }
  });

  describe('bia mộ ở /sw.js', () => {
    // Tệp không tồn tại thì chính phép đọc ở đầu tệp này ném — đó là phép kiểm sự tồn tại.
    it('chiếm quyền ngay, không chờ tab đóng hết', () => {
      expect(biaMo).toContain('skipWaiting');
      expect(biaMo).toContain('clients.claim');
    });

    it('xoá sạch kho rồi tự gỡ đăng ký', () => {
      const s = biaMo;
      expect(s).toContain('caches.delete');
      expect(s).toContain('registration.unregister');
    });

    /**
     * Chốt quan trọng nhất: bia mộ TUYỆT ĐỐI không được có bộ bắt `fetch`. Có nó là lại chặn
     * điều hướng — tức tái tạo đúng thứ đang cần gỡ.
     */
    it('KHÔNG chặn điều hướng', () => {
      expect(biaMo).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
    });

    /** Nạp lại các tab đang bị bản cũ điều khiển, nếu không họ vẫn ngồi trước mã cũ tới khi tự F5. */
    it('nạp lại tab đang mở sau khi dọn xong', () => {
      expect(biaMo).toContain('navigate');
    });

    /**
     * Bia mộ không được lọt vào kho nạp trước của sw-v2: nó là tệp phải LUÔN đi thẳng ra mạng,
     * còn nằm trong kho nạp trước thì chính bản mới lại ghim bản bia mộ.
     */
    it('không bị sw-v2 nạp trước', () => {
      expect(viteConfig).toMatch(/globIgnores:\s*\[[^\]]*sw\.js/);
    });
  });
});
