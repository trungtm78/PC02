/**
 * Turn the recording into a single self-contained HTML page.
 *
 * The page reads top to bottom in the order a case matures, because that is the
 * order someone learning the system meets each screen. Every image is a real
 * screenshot from the run that produced this file; nothing is drawn, and no
 * step is described that the recorder could not actually perform.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.GUIDE_OUT || path.resolve(__dirname, '../../docs/huong-dan-su-dung');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

/**
 * `--inline` embeds every screenshot as a data URI so the page is one file.
 * The hosted copy needs it (nothing can fetch a sibling folder); the repo copy
 * does not, and would be a 8MB diff on every re-record if it did.
 */
const INLINE = process.argv.includes('--inline');
const srcFor = (image) => {
  if (!INLINE) return `anh/${image}`;
  const buf = fs.readFileSync(path.join(ROOT, 'anh', image));
  return `data:image/png;base64,${buf.toString('base64')}`;
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CHAPTER_NOTE = {
  'Bắt đầu': 'Đăng nhập và đọc màn hình đầu ca. Chưa tạo gì, chỉ để biết mình đang đứng ở đâu.',
  'Đơn thư':
    'Nơi dữ liệu sinh ra. Gần như mọi hồ sơ trong hệ thống đều bắt đầu bằng một lá đơn của công dân.',
  'Vụ việc':
    'Đơn có dấu hiệu tội phạm trở thành nguồn tin về tội phạm, và bắt đầu chạy thời hạn xác minh.',
  'Vụ án': 'Xác minh đủ căn cứ thì khởi tố. Hồ sơ vụ án giữ đường dẫn ngược về vụ việc và về lá đơn gốc.',
  'Người và tài liệu': 'Hồ sơ đã có rồi mới gắn được người liên quan, tài liệu và vật chứng vào.',
  'Báo cáo': 'Báo cáo chỉ đọc lại những gì các bước trên đã nhập. Không có bảng nhập số liệu riêng.',
  'Quản trị': 'Ai được làm gì, và phân hệ nào đang bật. Việc của quản trị viên, không phải của cán bộ thụ lý.',
};

const chapters = [];
for (const step of manifest.steps) {
  let c = chapters.find((x) => x.name === step.chapter);
  if (!c) chapters.push((c = { name: step.chapter, steps: [] }));
  c.steps.push(step);
}

const stamp = new Date(manifest.generatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

const nav = chapters
  .map(
    (c, i) => `<li><a href="#ch-${i}"><span class="n">${i + 1}</span>${esc(c.name)}</a>
      <ul>${c.steps.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.title)}</a></li>`).join('')}</ul></li>`,
  )
  .join('');

const body = chapters
  .map(
    (c, i) => `
<section class="chapter" id="ch-${i}">
  <header class="ch-head">
    <span class="ch-num">Chương ${i + 1}</span>
    <h2>${esc(c.name)}</h2>
    <p class="ch-note">${esc(CHAPTER_NOTE[c.name] || '')}</p>
  </header>
  ${c.steps
    .map(
      (s) => `
  <article class="step${s.ok ? '' : ' failed'}" id="${esc(s.id)}">
    <h3>${esc(s.title)}</h3>
    ${s.why ? `<p class="why"><b>Vì sao:</b> ${esc(s.why)}</p>` : ''}
    ${s.how ? `<p class="how"><b>Thao tác:</b> ${esc(s.how)}</p>` : ''}
    ${s.data ? `<p class="data">Dữ liệu trong ảnh: ${esc(s.data)}</p>` : ''}
    ${s.ok ? '' : `<p class="err">Bước này không chạy được khi ghi hướng dẫn: ${esc(s.error)}</p>`}
    <figure><img src="${srcFor(s.image)}" alt="${esc(s.title)}" loading="lazy">
    <figcaption>Ảnh chụp thật trong lần ghi này</figcaption></figure>
  </article>`,
    )
    .join('')}
</section>`,
  )
  .join('');

const facts = Object.entries(manifest.facts)
  .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
  .join('');

const html = `<title>Hướng dẫn sử dụng — Hệ thống quản lý vụ án PC02</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{
    --bg:#f7f6f2; --panel:#fff; --ink:#1c1f24; --muted:#5b6472; --line:#e3e1da;
    --brand:#003973; --accent:#b58a2f; --err:#b42318; --code:#f2f1ec;
    --banner:#003973; --on-banner:#ffffff;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#14171c; --panel:#1b1f26; --ink:#e9ecf1; --muted:#9aa4b2; --line:#2a3039;
      --brand:#7fb0e8; --accent:#d9b45f; --err:#ff8a80; --code:#232830;
      --banner:#0b2745; --on-banner:#e9ecf1;
    }
  }
  :root[data-theme="dark"]{
    --bg:#14171c; --panel:#1b1f26; --ink:#e9ecf1; --muted:#9aa4b2; --line:#2a3039;
    --brand:#7fb0e8; --accent:#d9b45f; --err:#ff8a80; --code:#232830;
    --banner:#0b2745; --on-banner:#e9ecf1;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:16px/1.65 "Segoe UI",system-ui,-apple-system,"Noto Sans",sans-serif;}
  .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
  /* Banner colour lives in tokens, not in a media block: a colour whose only
     definition sits behind [data-theme] never applies in the un-stamped
     "system" state, which is what most viewers actually get. */
  header.top{background:var(--banner);color:var(--on-banner);padding:38px 0 30px}
  header.top h1{margin:0 0 6px;font-size:30px;letter-spacing:-.2px}
  header.top p{margin:0;opacity:.85;max-width:70ch}
  .meta{margin-top:18px;font-size:13px;opacity:.8}
  .layout{display:grid;grid-template-columns:270px 1fr;gap:34px;align-items:start;padding:30px 0 70px}
  @media (max-width:900px){.layout{grid-template-columns:1fr}nav.toc{position:static}}
  nav.toc{position:sticky;top:16px;background:var(--panel);border:1px solid var(--line);
    border-radius:10px;padding:16px 14px;max-height:calc(100vh - 40px);overflow:auto}
  nav.toc h4{margin:0 0 10px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
  nav.toc ul{list-style:none;margin:0;padding:0}
  nav.toc>ul>li{margin-bottom:10px}
  nav.toc a{color:var(--ink);text-decoration:none;display:block;padding:3px 0;font-size:14px}
  nav.toc a:hover{color:var(--brand);text-decoration:underline}
  nav.toc ul ul a{font-size:13px;color:var(--muted);padding-left:24px}
  .n{display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-size:11px;
    border-radius:4px;background:var(--brand);color:var(--panel);margin-right:8px;font-weight:700}
  a:focus-visible,img:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  .intro{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--accent);
    border-radius:8px;padding:18px 20px;margin-bottom:28px}
  .intro h3{margin:0 0 8px;font-size:17px}
  .intro p{margin:0 0 10px;color:var(--muted)}
  .intro p:last-child{margin-bottom:0}
  .chapter{margin-bottom:46px}
  .ch-head{border-bottom:2px solid var(--line);padding-bottom:12px;margin-bottom:22px}
  .ch-num{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);font-weight:700}
  .ch-head h2{margin:4px 0 6px;font-size:24px}
  .ch-note{margin:0;color:var(--muted);max-width:78ch}
  .step{background:var(--panel);border:1px solid var(--line);border-radius:10px;
    padding:20px 22px;margin-bottom:22px}
  .step.failed{border-color:var(--err)}
  .step h3{margin:0 0 12px;font-size:19px;color:var(--brand)}
  .step p{margin:0 0 10px;max-width:82ch}
  .why b,.how b{color:var(--ink)}
  .why,.how{color:var(--muted)}
  .data{font-size:14px;background:var(--code);border-radius:6px;padding:8px 12px;display:inline-block}
  .err{color:var(--err);font-weight:600}
  figure{margin:14px 0 0}
  figure img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:8px;
    background:var(--panel)}
  figcaption{margin-top:6px;font-size:12px;color:var(--muted)}
  table.facts{border-collapse:collapse;width:100%;margin-top:10px;font-size:14px}
  table.facts{font-variant-numeric:tabular-nums}
  table.facts td{border:1px solid var(--line);padding:7px 10px;vertical-align:top}
  table.facts td:first-child{color:var(--muted);width:34%}
  .foot{border-top:1px solid var(--line);margin-top:34px;padding-top:18px;color:var(--muted);font-size:13px}
  code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:13px}
</style>

<header class="top"><div class="wrap">
  <h1>Hướng dẫn sử dụng hệ thống quản lý vụ án PC02</h1>
  <p>Đi theo vòng đời một hồ sơ: đơn thư của công dân → vụ việc cần xác minh → vụ án đã khởi tố →
     người và tài liệu → báo cáo. Mỗi ảnh trong tài liệu này là ảnh chụp màn hình thật.</p>
  <div class="meta">Ghi lúc ${esc(stamp)} · ${manifest.steps.length} bước ·
    tài khoản <code>${esc(manifest.account)}</code> · ${esc(manifest.baseURL)}</div>
</div></header>

<div class="wrap layout">
  <nav class="toc"><h4>Mục lục</h4><ul>${nav}</ul></nav>
  <main>
    <div class="intro">
      <h3>Đọc tài liệu này thế nào</h3>
      <p>Thứ tự các chương là thứ tự dữ liệu lớn lên, không phải thứ tự của menu. Đọc từ đầu đến cuối
         một lượt sẽ thấy rõ vì sao màn hình sau cần màn hình trước; tra cứu lẻ thì dùng mục lục bên trái.</p>
      <p>Toàn bộ ảnh được chụp trong một lần chạy thật: kịch bản tự đăng nhập, tự gõ vào form và tự bấm lưu
         như một cán bộ đang trực. Không có bản ghi nào được nhét thẳng vào cơ sở dữ liệu, nên nếu một màn
         hình trong tài liệu đã đổi, lần ghi lại sau sẽ hỏng ngay tại chỗ đó thay vì âm thầm mô tả sai.</p>
      <p><b>Số hiệu trong ảnh là số thật do hệ thống cấp</b> — số tiếp nhận đơn, mã vụ việc, mã hồ sơ vụ án
         đều do máy sinh trong chính lần chạy đó, không phải chữ vẽ thêm.</p>
    </div>
    ${body}
    <section class="chapter">
      <div class="ch-head"><span class="ch-num">Phụ lục</span><h2>Dữ liệu do lần ghi này tạo ra</h2>
      <p class="ch-note">Những giá trị dưới đây do hệ thống cấp trong lúc ghi, không phải nhập tay.</p></div>
      <div class="step"><table class="facts">${facts}</table></div>
    </section>
    <div class="foot">
      Tài liệu tự sinh từ <code>tools/guide-html</code>. Chạy lại:
      <code>node tools/guide-html/record.mjs &amp;&amp; node tools/guide-html/build.mjs</code>
      (cần backend <code>:3000</code> và frontend <code>:5173</code> đang chạy).
      ${manifest.failures.length ? `<br><b style="color:var(--err)">${manifest.failures.length} bước lỗi khi ghi — xem phần được đánh dấu đỏ ở trên.</b>` : ''}
    </div>
  </main>
</div>`;

const outFile = path.join(ROOT, INLINE ? 'index.inline.html' : 'index.html');
fs.writeFileSync(outFile, html, 'utf8');
const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
console.log(`Đã sinh ${outFile} — ${manifest.steps.length} bước, ${chapters.length} chương, ${mb} MB`);
