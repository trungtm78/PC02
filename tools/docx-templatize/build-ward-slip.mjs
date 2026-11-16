/**
 * Builds the template of the request slip of a ward assignment request ("Phiếu yêu cầu", entity type
 * HO_SO_PHAN_CONG) from the Word file PC02 uses today (`YCĐT 1949A CAP.Vườn Lài 321.docx`).
 *
 *  - Keeps the layout and the formatting of the original: only text is touched, paragraph by paragraph.
 *  - The sample data becomes `{placeholders}` of the field catalogue (`field-catalog.ts`, HO_SO_PHAN_CONG).
 *  - The numbered list of requirements becomes ONE paragraph holding `{yeuCau}` ("1. …" per soft line).
 *  - The signature blocks get the names of the signers.
 *
 * Run: node tools/docx-templatize/build-ward-slip.mjs [<source .docx>] [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { readDocx, getDocumentXml, splitBody, writeDocx, encode } from './lib/docx.mjs';
import { applyRules, paragraphText } from './lib/replace.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0 ? args[outIdx + 1] : 'backend/prisma/seed-assets/ward-docx';
const SRC =
  args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1) ??
  'C:/PC02/pc02-case-management/docs/Requirements/YCĐT 1949A CAP.Vườn Lài 321.docx';

const P_RE = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const INVESTIGATOR = 'Thượng tá Mai Trọng Hạnh - Điều tra viên cao cấp là Trưởng Công an P.Vườn Lài, TP.HCM';

const norm = (t) => t.replace(/\s+/g, ' ').trim();
const textOf = (p) => norm(paragraphText(p));

/** The properties of a paragraph (`<w:pPr>…</w:pPr>`), '' when it has none. */
const pPrOf = (p) => (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(p) ?? [''])[0];
const paragraph = (pPr, rPr, text) => `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${encode(text)}</w:t></w:r></w:p>`;

const zip = readDocx(SRC);
// The source mixes composed and decomposed Vietnamese letters ("Hồ" as H + ô + U+0300): text is compared, so every
// text node is brought to the composed form first (it renders the same).
const composed = getDocumentXml(zip).replace(
  /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g,
  (_m, open, text, close) => `${open}${text.normalize('NFC')}${close}`,
);
const [prefix, bodyInner, suffix] = splitBody(composed);
const paras = bodyInner.match(P_RE) ?? [];
const find = (pred, what) => {
  const i = paras.findIndex((p) => pred(textOf(p)));
  if (i < 0) throw new Error(`paragraph not found: ${what}`);
  return i;
};

const iNumber = find((t) => t.startsWith('Số:') && t.includes('PYC'), 'number');
const iDate = find((t) => t.startsWith('Thành phố Hồ Chí Minh, ngày'), 'date line');
const iOpening = find((t) => t.startsWith('Ngày ') && t.includes('Báo cáo đề xuất'), 'opening paragraph');
const iFirstReq = find((t) => t.startsWith('1. '), 'first requirement');
const iClosing = find((t) => t.startsWith('Yêu cầu ') && t.endsWith('./.'), 'closing paragraph');
const iSignHeads = find((t) => t.includes('BAN CHỈ HUY') && t.includes('CÁN BỘ THẨM ĐỊNH'), 'signature headings');
const iLeaderHead = find((t) => t.startsWith('Ý KIẾN CỦA'), 'leader heading');
if (!(iFirstReq < iClosing && iClosing < iSignHeads && iSignHeads < iLeaderHead)) throw new Error('unexpected order of paragraphs');

/** index → new XML ('' drops the paragraph). */
const out = new Map();
out.set(iNumber, applyRules(paras[iNumber], [{ find: '1949A/PYC-PC02-Đ1', to: '{soVanBan}' }]));
out.set(iDate, applyRules(paras[iDate], [{ find: 'ngày 05 tháng 11 năm 2026', to: '{ngayPhatHanh}' }]));
out.set(
  iOpening,
  applyRules(paras[iOpening], [
    { find: INVESTIGATOR, to: '{dieuTraVien}' },
    { find: '05/11/2026', to: '{ngayTrinh}' },
    { find: 'Công an P.Vườn Lài, TP.HCM', to: '{tenDonVi}' },
    { find: 'khởi tố, điều tra vụ án', to: '{loaiViec}' },
    { find: 'Đánh bạc', to: '{toiDanh}' },
    { find: '11/4/2026', to: '{ngayPhatHien}' },
    { find: 'giao lộ Lý Thái Tổ - Lê Hồng Phong, P.Vườn Lài, TP.HCM', to: '{noiXayRa}' },
    { find: 'Nguyễn Chí Kiệt cùng đồng bọn', to: '{doiTuong}' },
    { find: /thực hiện\.\s*$/, to: 'thực hiện.{dongLyDoTraVe}' },
  ]),
);
// The numbered list: one paragraph, the layout of a requirement, the text of a requirement (not its bold number).
const second = paras[iFirstReq + 1];
const plainRun = [...second.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)]
  .map((m) => m[1])
  .find((r) => (/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/.exec(r)?.[1] ?? '').trim().length > 3);
const plainRPr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(plainRun ?? '') ?? [''])[0];
out.set(iFirstReq, paragraph(pPrOf(second), plainRPr, '{yeuCau}'));
for (let i = iFirstReq + 1; i < iClosing; i++) out.set(i, '');
out.set(iClosing, applyRules(paras[iClosing], [{ find: INVESTIGATOR, to: '{dieuTraVien}' }]));
// The names under the two headings: the headings' own paragraph (its tabs keep the columns), names in place of titles.
const lastBlankBeforeLeader = iLeaderHead - 1;
if (textOf(paras[lastBlankBeforeLeader]) !== '') throw new Error('expected a blank line above the leader heading');
out.set(
  lastBlankBeforeLeader,
  applyRules(paras[iSignHeads], [
    { find: 'BAN CHỈ HUY ĐỘI 1 PC02', to: '{tenChiHuyDoi}' },
    { find: 'CÁN BỘ THẨM ĐỊNH', to: '{tenCanBoThamDinh}' },
  ]),
);
// The leader signs under their opinion: room to write, then the name, in the heading's own style.
const blank = paras[iSignHeads + 1];
const leaderName = applyRules(paras[iLeaderHead], [{ whole: /[\s\S]+/, to: '{tenLanhDaoPhong}' }]);
const tail = paras.length > iLeaderHead + 1 ? iLeaderHead + 1 : iLeaderHead;
out.set(tail, (out.get(tail) ?? paras[tail]) + blank + blank + blank + leaderName);

let rebuilt = '';
let cursor = 0;
let k = 0;
P_RE.lastIndex = 0;
for (const m of bodyInner.matchAll(P_RE)) {
  rebuilt += bodyInner.slice(cursor, m.index);
  rebuilt += out.has(k) ? out.get(k) : m[0];
  cursor = m.index + m[0].length;
  k++;
}
rebuilt += bodyInner.slice(cursor);

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'PHIEU_YEU_CAU.docx');
writeDocx(zip, prefix + rebuilt + suffix, outPath);

const finalText = (rebuilt.match(P_RE) ?? []).map((p) => paragraphText(p)).join('\n');
const vars = [...new Set(finalText.match(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g) ?? [])];
console.log(`✔ ${outPath} — ${vars.length} variables: ${vars.join(' ')}`);
const LEFTOVER = ['Mai Trọng Hạnh', 'Vườn Lài', 'Nguyễn Chí Kiệt', '1949A', '05/11/2026', '11/4/2026', 'Đánh bạc', 'Lý Thái Tổ', 'phê chuẩn của VKS', 'F168'];
const hits = LEFTOVER.filter((x) => finalText.includes(x));
if (hits.length) {
  console.error(`⚠ sample data left: ${hits.join(' | ')}`);
  process.exit(1);
}
console.log('✅ No sample data left.');
