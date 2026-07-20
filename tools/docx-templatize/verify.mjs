/**
 * Kiểm tra 7 file mẫu: mở được bằng docxtemplater, render với dữ liệu giả,
 * không còn placeholder sót và không còn dữ liệu mẫu của PC01.
 *
 * Chạy: node tools/docx-templatize/verify.mjs [thư mục]
 */
import fs from 'node:fs';
import path from 'node:path';
import PizZip from '../../backend/node_modules/pizzip/js/index.js';
import Docxtemplater from '../../backend/node_modules/docxtemplater/js/docxtemplater.js';
import { readDocx, getDocumentXml, splitBody, scanBlocks } from './lib/docx.mjs';
import { paragraphText } from './lib/replace.mjs';

const DIR = process.argv[2] ?? 'backend/prisma/seed-assets/petition-docx';
const CODES = [
  'PHIEU_DE_XUAT', 'PHIEU_CHUYEN_NGUON_TIN', 'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN', 'THONG_BAO_HUONG_DAN', 'THONG_BAO_TRA_LAI', 'BIEN_NHAN',
];

// Dữ liệu giả — phủ mọi biến có thể xuất hiện
const DATA = {
  soVanBan: '1234', teamCode: 'Đ1', tenDoi: 'Đội 1', tenDoiPhongBan: 'ĐỘI THAM MƯU TỔNG HỢP',
  diaDiem: 'Thành phố Hồ Chí Minh', ngayPhatHanh: 'ngày 18 tháng 07 năm 2026',
  ngayNhan: 'ngày 15 tháng 07 năm 2026', ngayDon: 'ngày 06 tháng 07 năm 2026',
  ngayNhanNgan: '15/7/2026', ngayDonNgan: '6/7/2026', gioTiepNhan: '09:30',
  loaiDon: 'Tố giác', ghiTen: 'Nguyễn Văn A', namSinh: '1990',
  diaChi: '123 Lê Lợi, phường Bến Nghé, TP.HCM', nguonDon: 'Bưu điện',
  noiDung: 'Nội dung tố giác mẫu để kiểm thử.', dinhKem: 'tài liệu photo',
  raSoatTrung: 'Không', baoCaoBGD: 'Không', nhanThay: 'Nhận thấy mẫu.', deXuat: 'Đề xuất mẫu',
  donViNhan: 'Cơ sở 1', soCCCD: '079090000123', ngayCapCCCD: '19/4/2021',
  noiCapCCCD: 'Cục CSQLHC về TTXH', chucVuCanBo: 'Cán bộ',
  coQuan: 'Cơ quan CSĐT Công an TP Hồ Chí Minh',
  noiTiepNhan: 'trực ban Phòng Cảnh sát Hình sự Công an TP Hồ Chí Minh, số 459 Trần Hưng Đạo',
  tenCanBoDeXuat: 'Đại úy Trần Văn B', tenPhoDoiTruong: 'Trung tá Lê Văn C',
  tenTruongPhong: 'Thượng tá Phạm Văn D', vietTatCanBo: 'V.B',
};

const SAMPLE_LEFTOVER = [
  'Trần Thị Vân Thanh', 'Nguyễn Võ Uyên Trang', 'Phạm Văn Huy', 'Hoàng Công Việt',
  'Nguyễn Trung Hoà', '9695', '074306003485', 'Võ Khánh Vy', 'V.Huy', '13/7/2026', '06/7/2026',
];

let failed = 0;
for (const code of CODES) {
  const file = path.join(DIR, `${code}.docx`);
  if (!fs.existsSync(file)) {
    console.error(`✗ ${code}: KHÔNG TỒN TẠI`);
    failed++;
    continue;
  }
  // 1) Text nguồn: không còn dữ liệu mẫu
  const srcText = (() => {
    const zip = readDocx(file);
    const [, body] = splitBody(getDocumentXml(zip));
    return scanBlocks(body).map((b) => (b.xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? []).map(paragraphText).join('\n')).join('\n');
  })();
  const dirty = SAMPLE_LEFTOVER.filter((s) => srcText.includes(s));

  // 2) Render thật
  let rendered = '';
  let renderErr = null;
  try {
    const doc = new Docxtemplater(new PizZip(fs.readFileSync(file)), {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' },
      nullGetter: () => '',
    });
    doc.render(DATA);
    const out = doc.getZip().generate({ type: 'nodebuffer' });
    const zip2 = new PizZip(out);
    const xml = zip2.file('word/document.xml').asText();
    rendered = (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]*>/g, ''))
      .join('');
  } catch (e) {
    renderErr = e.properties?.errors?.map((x) => x.properties.explanation).join('; ') ?? e.message;
  }

  const leftoverVar = rendered.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g);
  const ok = !renderErr && !dirty.length && !leftoverVar;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✗'} ${code}`);
  if (renderErr) console.log(`    lỗi render: ${renderErr}`);
  if (dirty.length) console.log(`    còn dữ liệu mẫu: ${dirty.join(' | ')}`);
  if (leftoverVar) console.log(`    placeholder chưa bind: ${[...new Set(leftoverVar)].join(' ')}`);
}

console.log(failed === 0 ? '\n✅ 7/7 mẫu hợp lệ.' : `\n❌ ${failed} mẫu có vấn đề.`);
process.exit(failed === 0 ? 0 : 1);
