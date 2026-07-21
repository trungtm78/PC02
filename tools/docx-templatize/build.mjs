/**
 * Sinh 7 file mẫu chứng từ Đơn thư từ 2 file gốc PC01 (TT 128/2025/TT-BCA).
 *
 *  - Tách file DeXuat (6 chứng từ trong 1 file) thành từng file riêng.
 *  - Thay dữ liệu mẫu bằng placeholder {tenBien} của engine docxtemplater.
 *  - GIỮ NGUYÊN toàn bộ định dạng gốc (styles/header/table/font) — chỉ đụng text.
 *
 * Chạy: node tools/docx-templatize/build.mjs [--out <thư mục>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { readDocx, getDocumentXml, splitBody, scanBlocks, writeDocx, encode } from './lib/docx.mjs';
import { applyRules, paragraphText } from './lib/replace.mjs';

const SRC_DIR = 'C:/PC02/docs/requirements/FILE GUI PC01';
const SRC_DEXUAT = path.join(SRC_DIR, 'ho_so_don_thu_DeXuat.docx');
const SRC_BIENBAN = path.join(SRC_DIR, 'ho_so_don_thu_BienBan.docx');
const OUT_DIR = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'backend/prisma/seed-assets/petition-docx';

// ── Rule dùng chung cho 6 chứng từ trong file DeXuat ────────────────────────
const COMMON = [
  // Nhãn → giá trị (giữ nhãn, thay phần sau dấu ':')
  { label: /^Ghi tên:\s*/, to: '{ghiTen}' },
  { label: /^Ông\/bà:\s*/, to: '{ghiTen}' },
  { label: /^Địa chỉ:\s*/, to: '{diaChi}' },
  { label: /^Nguồn đơn:\s*/, to: '{nguonDon}' },
  { label: /^Nội dung:\s*/, to: '{noiDung}' },
  { label: /^Tóm tắt nội dung đơn:\s*/, to: '{noiDung}' },
  { label: /^Đồ vật, tài liệu kèm theo:\s*/, to: '{dinhKem}' },
  { label: /^Rà soát đơn, vụ việc, vụ án trùng:\s*/, to: '{raSoatTrung}' },
  { label: /^Thuộc trường hợp báo cáo (?:Ban giám đốc|BGĐ):\s*/, to: '{baoCaoBGD}' },
  { label: /^Nhận thấy:\s*/, to: '{nhanThay}' },
  { label: /^Đề xuất:\s*/, to: '{deXuat}', keepTail: '\\./\\.' },
  // Khối đầu trang
  { find: 'ĐỘI THAM MƯU TỔNG HỢP', to: '{tenDoiPhongBan}' },
  { whole: /Thành phố Hồ Chí Minh, ngày 20 tháng 7 năm 2026/, to: '{diaDiem}, {ngayPhatHanh}' },
  { find: '- Ban chỉ huy Đội 1.', to: '- Ban chỉ huy {tenDoi}.' },
  { whole: /Ngày 13\/7\/2026, Đội 1 nhận được:/, to: 'Ngày {ngayNhanNgan}, {tenDoi} nhận được:' },
  { whole: /Đơn Tố giác ghi ngày 06\/7\/2026/, to: 'Đơn {loaiDon} ghi ngày {ngayDonNgan}' },
  { find: 'PHÓ ĐỘI TRƯỞNG ĐỘI 1', to: 'PHÓ ĐỘI TRƯỞNG {tenDoi}' },
  // Chữ ký
  { find: 'Trung tá Hoàng Công Việt', to: '{tenPhoDoiTruong}' },
  { find: 'Thượng tá Nguyễn Trung Hoà', to: '{tenTruongPhong}' },
  // Còn sót trong câu văn (chạy SAU các rule nhãn ở trên)
  { find: 'Tố giác đề ngày 06/7/2026', to: '{loaiDon} đề ngày {ngayDonNgan}', all: true },
  { find: 'đơn Tố giác ghi ngày 06/7/2026', to: 'đơn {loaiDon} ghi ngày {ngayDonNgan}', all: true },
  { find: 'ghi tên ông/bà Trần Thị Vân Thanh', to: 'ghi tên ông/bà {ghiTen}', all: true },
  { find: 'nguồn đơn từ Bưu điện', to: 'nguồn đơn từ {nguonDon}', all: true },
  { find: 'Xét thấy Tố giác không', to: 'Xét thấy {loaiDon} không', all: true },
  { find: 'Ông/Bà Trần Thị Vân Thanh', to: 'Ông/Bà {ghiTen}', all: true },
  { find: 'Trần Thị Vân Thanh', to: '{ghiTen}', all: true },
  { find: '13/7/2026', to: '{ngayNhanNgan}', all: true },
  { find: '06/7/2026', to: '{ngayDonNgan}', all: true },
  { find: 'Cơ sở 1', to: '{donViNhan}', all: true },
  // Khối "Nơi nhận" — nơi gửi báo cáo lại chính là nguồn đơn; mã đội động
  { find: '- Bưu điện (thay báo cáo);', to: '- {nguonDon} (thay báo cáo);' },
  { find: 'PC02-Đ1', to: 'PC02-{teamCode}', all: true },
  { find: 'V.Huy', to: '{vietTatCanBo}', all: true }, // viết tắt cán bộ soạn ở dòng "Lưu:"
];

/** Rule số văn bản theo từng loại (ĐX/PC/TB/HD). */
const soVanBan = (kyHieu) => ({
  whole: new RegExp(`Số: 9695/${kyHieu}-PC02-Đ1`),
  to: `Số: {soVanBan}/${kyHieu}-PC02-{teamCode}`,
});

const DOCS = [
  {
    code: 'PHIEU_DE_XUAT',
    src: SRC_DEXUAT,
    blocks: [0, 20],
    rules: [soVanBan('ĐX'), ...COMMON],
    // Cột "CÁN BỘ ĐỀ XUẤT" trong bảng chữ ký đang trống → đặt tên NGƯỜI IN, canh
    // ngang hàng với tên ở cột "PHÓ ĐỘI TRƯỞNG" (cùng offset +7 đoạn).
    setText: [{ anchor: 'CÁN BỘ ĐỀ XUẤT', offset: 7, to: '{tenCanBoDeXuat}' }],
  },
  { code: 'PHIEU_CHUYEN_NGUON_TIN', src: SRC_DEXUAT, blocks: [65, 82], rules: [soVanBan('PC'), ...COMMON] },
  { code: 'PHIEU_CHUYEN_DON', src: SRC_DEXUAT, blocks: [84, 100], rules: [soVanBan('PC'), ...COMMON] },
  { code: 'THONG_BAO_CHUYEN', src: SRC_DEXUAT, blocks: [102, 114], rules: [soVanBan('TB'), ...COMMON] },
  { code: 'THONG_BAO_HUONG_DAN', src: SRC_DEXUAT, blocks: [116, 129], rules: [soVanBan('HD'), ...COMMON] },
  { code: 'THONG_BAO_TRA_LAI', src: SRC_DEXUAT, blocks: [131, 143], rules: [soVanBan('TB'), ...COMMON] },
  {
    code: 'BIEN_NHAN',
    src: SRC_BIENBAN,
    blocks: null, // dùng cả file
    dropParagraphs: [/^Đồng thời, bà Trang đề nghị/], // câu thuộc nội dung mẫu
    // Nghiệp vụ PC02: CƠ QUAN giao giấy biên nhận cho người đứng đơn → NGƯỜI GIAO
    // là cán bộ (người in), NGƯỜI NHẬN là người đứng đơn. Bản mẫu PC01 ghi ngược
    // nên phải hoán đổi (chạy sau rule chung, chỉ đụng KHỐI CHỮ KÝ — dòng thân bài
    // "Tôi: {tenCanBoDeXuat}" và "Họ và tên: {ghiTen}" giữ nguyên).
    setText: [
      { anchor: 'NGƯỜI GIAO', offset: 7, to: '{tenCanBoDeXuat}' },
      { anchor: 'NGƯỜI NHẬN', offset: 7, to: '{ghiTen}' },
    ],
    rules: [
      { find: /Hồi\s+giờ\s+ngày 15 tháng 7 năm 2026/, to: 'Hồi {gioTiepNhan} {ngayNhan}' },
      {
        find: 'trực ban Phòng Cảnh sát Hình sự Công an TP Hồ Chí Minh, số 459 Trần Hưng Đạo, phường Cầu Ông Lãnh, TP Hồ Chí Minh.',
        to: '{noiTiepNhan}',
      },
      { label: /^Tôi:\s*/, to: '{tenCanBoDeXuat}' },
      { label: /^Chức danh tư pháp\/Chức vụ:\s*/, to: '{chucVuCanBo}' },
      { find: 'thuộc Cơ quan CSĐT Công an TP Hồ Chí Minh', to: 'thuộc {coQuan}' },
      { find: 'đơn(*) Trình báo của:', to: 'đơn(*) {loaiDon} của:' },
      { whole: /Họ và tên: Nguyễn Võ Uyên Trang – Sinh năm: 2006/, to: 'Họ và tên: {ghiTen} – Sinh năm: {namSinh}' },
      { find: '074306003485', to: '{soCCCD}' },
      { find: '19/4/2021', to: '{ngayCapCCCD}' },
      { find: 'Cục CSQLHC về TTXH', to: '{noiCapCCCD}' },
      { label: /^Địa chỉ:\s*/, to: '{diaChi}' },
      { label: /^Tóm tắt nội dung đơn:\s*/, to: '{noiDung}' },
      { label: /^Tài liệu, đồ vật kèm theo:\s*/, to: '{dinhKem}' },
      { find: 'Nguyễn Võ Uyên Trang', to: '{ghiTen}', all: true },
      { find: 'Phạm Văn Huy', to: '{tenCanBoDeXuat}', all: true },
    ],
  },
];

// ── Xử lý ───────────────────────────────────────────────────────────────────
const P_RE = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;

/** Chèn text vào một đoạn TRỐNG (đoạn không có <w:t>) — giữ <w:pPr> canh lề. */
function fillEmptyParagraph(pXml, text) {
  const run = `<w:r><w:t xml:space="preserve">${encode(text)}</w:t></w:r>`;
  return pXml.replace(/<\/w:p>$/, `${run}</w:p>`);
}

/** Đặt NỘI DUNG cho một đoạn — dù đoạn đang trống hay đã có chữ (giữ định dạng). */
function setParagraphText(pXml, text) {
  const cur = paragraphText(pXml);
  if (!cur.trim()) return fillEmptyParagraph(pXml, text);
  return applyRules(pXml, [{ whole: /[\s\S]+/, to: text }]);
}

function processDoc(doc) {
  const zip = readDocx(doc.src);
  const [prefix, bodyInner, suffix] = splitBody(getDocumentXml(zip));
  const blocks = scanBlocks(bodyInner);
  const sectPr = blocks.find((b) => b.tag === 'w:sectPr');

  let content = doc.blocks
    ? blocks.slice(doc.blocks[0], doc.blocks[1] + 1).map((b) => b.xml).join('')
    : blocks.filter((b) => b.tag !== 'w:sectPr').map((b) => b.xml).join('');

  // Bỏ ngắt trang (mỗi file chỉ còn 1 chứng từ)
  content = content.replace(/<w:br\s+w:type="page"\s*\/>/g, '');

  // Áp rule theo TỪNG đoạn (w:p không lồng nhau nên regex an toàn)
  const paras = content.match(P_RE) ?? [];
  const kept = [];
  paras.forEach((p) => {
    const text = paragraphText(p).replace(/\s+/g, ' ').trim();
    if (doc.dropParagraphs?.some((re) => re.test(text))) {
      kept.push({ p, out: null });
      return;
    }
    kept.push({ p, out: applyRules(p, doc.rules) });
  });

  // Đặt tên vào ô chữ ký (theo neo + offset) — chạy SAU rule chung nên ghi đè được.
  for (const ins of doc.setText ?? []) {
    const anchorIdx = kept.findIndex((k) => k.out && paragraphText(k.out).trim() === ins.anchor);
    const target = anchorIdx >= 0 ? kept[anchorIdx + ins.offset] : null;
    if (target && target.out) {
      target.out = setParagraphText(target.out, ins.to);
    } else {
      console.warn(`  ! ${doc.code}: không đặt được "${ins.to}" (neo "${ins.anchor}")`);
    }
  }

  // Ghép lại: thay từng đoạn gốc bằng đoạn đã xử lý (hoặc bỏ hẳn)
  let out = '';
  let cursor = 0;
  P_RE.lastIndex = 0;
  let m;
  let i = 0;
  while ((m = P_RE.exec(content)) !== null) {
    out += content.slice(cursor, m.index);
    if (kept[i].out !== null) out += kept[i].out;
    cursor = m.index + m[0].length;
    i++;
  }
  out += content.slice(cursor);

  const documentXml = prefix + out + (sectPr ? sectPr.xml : '') + suffix;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${doc.code}.docx`);
  writeDocx(zip, documentXml, outPath);

  // Báo cáo
  const finalText = (out.match(P_RE) ?? []).map((p) => paragraphText(p)).join('\n');
  const vars = [...new Set((finalText.match(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g) ?? []))];
  console.log(`✔ ${doc.code}.docx — ${vars.length} biến: ${vars.join(' ')}`);
  return { code: doc.code, text: finalText, vars };
}

const results = DOCS.map(processDoc);

// Cảnh báo dữ liệu mẫu còn sót
const LEFTOVER = [
  'Trần Thị Vân Thanh', 'Nguyễn Võ Uyên Trang', 'Phạm Văn Huy', 'Hoàng Công Việt',
  'Nguyễn Trung Hoà', '9695', '06/7/2026', '13/7/2026', '074306003485', 'Cơ sở 1',
  'Võ Khánh Vy', 'Bưu điện', '959 Cách Mạng',
];
let dirty = 0;
for (const r of results) {
  const hits = LEFTOVER.filter((s) => r.text.includes(s));
  if (hits.length) {
    dirty++;
    console.warn(`  ⚠ ${r.code} còn dữ liệu mẫu: ${hits.join(' | ')}`);
  }
}
console.log(dirty === 0 ? '\n✅ Sạch dữ liệu mẫu.' : `\n⚠ ${dirty} file còn dữ liệu mẫu — cần bổ sung rule.`);
