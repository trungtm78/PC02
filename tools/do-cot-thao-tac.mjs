/**
 * Đo TOẠ ĐỘ THẬT của các nút trong ô "Thao tác" trên prod, ở nhiều bề rộng màn hình.
 *
 * Vì sao cần: ca kiểm đơn vị chạy trong jsdom, mà jsdom KHÔNG dựng hình — nó không biết
 * `table-fixed` co cột hay `overflow: hidden` cắt nút. Lỗi 21/09/2026 (mất nút "In chứng từ"
 * và nút ⋮ trên cả ba màn danh sách) sống được đúng vì không phép đo nào chạm tới hình học.
 *
 * Chú thích trong `cotThaoTac.ts` từng nhắc tới `tests/e2e/cot-thao-tac-uat.e2e.spec.ts` như
 * một cổng đang canh việc này. Tệp ấy KHÔNG tồn tại. Một chú thích hứa phép đo không có thật
 * còn tệ hơn im lặng: nó làm người sau thôi đi đo.
 *
 * Dùng:
 *   U=<tài khoản> P=<mật khẩu> node tools/do-cot-thao-tac.mjs [http://host]
 *
 * Thoát 1 nếu có nút nào nằm ngoài mép ô ở bất kỳ bề rộng nào.
 */
import { chromium } from '@playwright/test';

const GOC = process.argv[2] ?? 'http://171.244.40.245';
const MAN = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
];
const DUONG = ['/petitions', '/incidents', '/cases'];

const { U, P } = process.env;
if (!U || !P) {
  console.error('Thiếu biến môi trường U / P (tài khoản đo). Không ghi mật khẩu vào kho mã.');
  process.exit(2);
}

const b = await chromium.launch();
const r = await b.newContext().then((c) =>
  c.request.post(`${GOC}/api/v1/auth/login`, { data: { username: U, password: P } }),
);
const j = await r.json();
const tok = j?.accessToken ?? j?.data?.accessToken;
if (!tok) {
  console.error('Đăng nhập thất bại:', JSON.stringify(j).slice(0, 200));
  process.exit(2);
}

let pham = 0;
for (const vp of MAN) {
  const p = await b.newPage({ viewport: vp });
  await p.addInitScript((t) => {
    sessionStorage.setItem('accessToken', t);
    localStorage.setItem('accessToken', t);
  }, tok);
  for (const duong of DUONG) {
    await p.goto(GOC + duong, { waitUntil: 'domcontentloaded' });
    try {
      await p.waitForSelector('table tbody tr', { timeout: 40000 });
    } catch {
      console.log(`${vp.width}px ${duong}: KHÔNG thấy bảng (${p.url()})`);
      pham++;
      continue;
    }
    const o = await p.evaluate(() => {
      const tr = document.querySelector('table tbody tr');
      const td = [...tr.querySelectorAll('td')].find((c) =>
        c.querySelector('[data-testid^="btn-view"]'),
      );
      if (!td) return null;
      const cell = td.getBoundingClientRect();
      return {
        phai: Math.round(cell.right),
        rong: Math.round(cell.width),
        nut: [...td.querySelectorAll('button')].map((e) => ({
          id: (e.getAttribute('data-testid') ?? 'x').split('-').slice(0, 2).join('-'),
          phai: Math.round(e.getBoundingClientRect().right),
        })),
      };
    });
    if (!o) {
      console.log(`${vp.width}px ${duong}: không thấy ô Thao tác`);
      pham++;
      continue;
    }
    const tran = o.nut.filter((n) => n.phai > o.phai);
    const trangThai = tran.length ? `TRÀN: ${tran.map((n) => n.id).join(', ')}` : 'ok';
    console.log(`${vp.width}px ${duong}: ô ${o.rong}px, ${o.nut.length} nút — ${trangThai}`);
    if (tran.length) pham++;
  }
  await p.close();
}
await b.close();

if (pham) {
  console.error(`\nCÓ ${pham} trường hợp nút bị cắt khỏi ô "Thao tác".`);
  process.exit(1);
}
console.log('\nMọi nút đều nằm trong ô ở mọi bề rộng đã đo.');
