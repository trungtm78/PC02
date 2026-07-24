/**
 * Báo cáo ánh xạ CHI TIẾT TỪNG KEY của hồ sơ cũ sang field hệ mới.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/field-map.ts --out "C:/PC02/anh-xa-tung-key.xlsx"
 *
 * Khác `field-gap.ts` (chỉ liệt kê cột CÓ dữ liệu, gộp mọi collection): công cụ này liệt kê
 * MỌI key — kể cả rỗng — của từng collection nghiệp vụ, và với mỗi key ghi rõ nó ĐỔ VÀO
 * FIELD NÀO của hệ mới (đọc thẳng từ mã builder), cùng trạng thái:
 *   ĐÃ MAPPING · CÓ DỮ LIỆU CHƯA MAPPING · RỖNG · RÁC (nền tảng bán hàng cũ).
 *
 * Đây là câu trả lời "mapping từng field một" — mỗi collection một sheet Excel.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type TrangThai =
  | 'ĐÃ MAPPING'
  | 'CÓ DỮ LIỆU CHƯA MAPPING'
  | 'RỖNG (chưa mapping)'
  | 'RÁC — nền tảng cũ'
  | 'KỸ THUẬT — xử lý đường khác';

/** Tiền tố/từ khoá của key rác từ nền tảng bán hàng cũ (không mang nghĩa nghiệp vụ án). */
const RAC = [
  'bank', 'chat_id', 'table_id', 'zalo', 'lark', 'hanet', 'ghn', 'kho_', 'qr_', 'api_', 'tab_',
  'man_hinh', 'son_logo', 'bitable', 'room_id', 'place_id', 'nv_id', 'id_hanet', 'id_cong_no',
  'id_nhap', 'ton_kho', 'cong_no', 'giam_gia', 'combo', 'vat_pham', 'dat_hang', 'ban_le', 'sales',
  'doanh_thu', 'ma_vach', 'thanh_toan', 'khu_vuc', 'chot_so', 'PageSize', 'MetaKeywords',
  'MetaDescription', 'MetaTitle', 'url', 'photo', 'avatar', 'link_image', 'thumb', 'gallery',
  'seo', 'bai_viet', 'hien_thi', 'sap_xep', 'show_home', 'da_xoa', 'chu_shop', 'faceid', 'face_id',
  'google_auth', 'hula_key', 'key_safari', 'key_thong_bao', 're_login', 'set_quyen', 'ctv',
];
const laRac = (k: string): boolean => RAC.some((r) => k.toLowerCase().includes(r.toLowerCase()));

/** Cột kỹ thuật — có ý nghĩa kỹ thuật, không phải nghiệp vụ, cố ý bỏ. */
const KY_THUAT = new Set(['_id', 'id', '_add_time', '_update_time', 'add_time', 'ten_search']);

/**
 * Cột nghiệp vụ NHÌN có dữ liệu nhưng KHÔNG map qua mapper vì đã xử lý ở đường khác — ghi
 * rõ để không hiểu nhầm là bỏ sót:
 *   • don_vi_id / nguoi_them → giải quyết ở `seed-org.ts` (→ Team / createdBy), không qua mapper.
 *   • stt → số thứ tự bản ghi cũ; sttCu đã lưu ở metadata, số này chỉ là chỉ mục nội bộ.
 *   • nam / thang / ngay → phần TÁCH của ngày; ngày nghiệp vụ đã lấy từ trường epoch (đã map).
 *   • da_nhan → cờ nội bộ "đã nhận" (5 hồ sơ), không có ô nghiệp vụ tương ứng.
 */
const XU_LY_DUONG_KHAC = new Set(['don_vi_id', 'nguoi_them', 'stt', 'nam', 'thang', 'ngay', 'da_nhan']);

/**
 * Đọc mã builder → với mỗi key, field hệ mới nó đổ vào.
 * Bắt các mẫu: `field: s(rec.key)`, `field: parseLegacyDate(rec.key)`, `field: num(rec['key'])`,
 * `field: parseLegacyNumber(rec.key)`, `field: parseLegacyBool(rec.key)`, `... rec.key ...`.
 */
function readKeyToField(): Map<string, string[]> {
  const src = fs.readFileSync(path.join(__dirname, '..', 'legacy-mapper.ts'), 'utf8');
  const out = new Map<string, string[]>();
  const add = (key: string, field: string) => {
    if (!key || field === 'legacySourceId') return;
    const cur = out.get(key) ?? [];
    if (!cur.includes(field)) cur.push(field);
    out.set(key, cur);
  };
  // Xét TỪNG DÒNG: một dòng có thể có `field: a(rec.k1) ?? b(rec.k2)` — cả k1 lẫn k2 đều
  // đổ vào `field`. Regex trước chỉ bắt key đầu → báo nhầm k2 là "chưa mapping".
  const keyRe = /rec(?:\.([a-zA-Z0-9_]+)|\['([^']+)'\])/g;
  const fieldRe = /^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/;
  for (const line of src.split('\n')) {
    const fm = fieldRe.exec(line);
    const keys = [...line.matchAll(keyRe)].map((m) => m[1] ?? m[2]).filter(Boolean) as string[];
    if (!keys.length) continue;
    // Có nhãn field ở đầu dòng → gán key vào field đó; không có (vd trong logic decompose,
    // normalizePhanLoai) → đánh dấu ĐÃ ĐỌC bằng field ẩn "(logic)".
    const field = fm ? fm[1] : '(logic)';
    for (const k of keys) add(k, field);
  }
  return out;
}

interface KeyRow {
  key: string;
  nhan: string;
  kieu: string;
  soHoSo: number;
  fieldDich: string;
  trangThai: TrangThai;
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : path.join(process.cwd(), 'anh-xa-tung-key.xlsx');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const keyToField = readKeyToField();

    // Nhãn tiếng Việt + kiểu, tra từ TruongTuyChinh.
    const defs = await prisma.legacyStaging.findMany({ where: { sourceFile: 'TruongTuyChinh' }, select: { raw: true } });
    const label = new Map<string, { ten: string; kieu: string }>();
    for (const d of defs) {
      const r = d.raw as Record<string, unknown>;
      const k = String(r.ten_truong ?? '').trim();
      if (k) label.set(k, { ten: String(r.ten_hien_thi ?? ''), kieu: String(r.kieu_du_lieu ?? '') });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PC02 — ánh xạ từng key';
    const cols = ['ho_so_doi_1', 'ho_so', 'TamDinhChi_vu_viec_21'];
    const tongKet: Record<string, Record<TrangThai, number>> = {};

    for (const col of cols) {
      const rows = await prisma.legacyStaging.findMany({ where: { sourceFile: col }, select: { raw: true } });
      const allKeys = new Set<string>();
      const cnt = new Map<string, number>();
      for (const r of rows) {
        for (const [k, v] of Object.entries(r.raw as Record<string, unknown>)) {
          if (/_search$/.test(k)) continue;
          allKeys.add(k);
          if (v !== null && v !== undefined && v !== '' && v !== 0 && v !== false) cnt.set(k, (cnt.get(k) ?? 0) + 1);
        }
      }

      const out: KeyRow[] = [];
      const dem: Record<TrangThai, number> = {
        'ĐÃ MAPPING': 0,
        'CÓ DỮ LIỆU CHƯA MAPPING': 0,
        'RỖNG (chưa mapping)': 0,
        'RÁC — nền tảng cũ': 0,
        'KỸ THUẬT — xử lý đường khác': 0,
      };
      for (const key of allKeys) {
        const soHoSo = cnt.get(key) ?? 0;
        const fields = keyToField.get(key) ?? [];
        let trangThai: TrangThai;
        if (fields.length) trangThai = 'ĐÃ MAPPING';
        else if (XU_LY_DUONG_KHAC.has(key)) trangThai = 'KỸ THUẬT — xử lý đường khác';
        else if (KY_THUAT.has(key) || laRac(key)) trangThai = 'RÁC — nền tảng cũ';
        else if (soHoSo > 0) trangThai = 'CÓ DỮ LIỆU CHƯA MAPPING';
        else trangThai = 'RỖNG (chưa mapping)';
        dem[trangThai]++;
        const lb = label.get(key);
        const ghiChu =
          trangThai === 'RÁC — nền tảng cũ' ? '(bỏ — nền tảng bán hàng cũ)' :
          trangThai === 'KỸ THUẬT — xử lý đường khác' ? '(seed-org / metadata / ngày epoch)' : '';
        out.push({
          key,
          nhan: lb?.ten ?? '',
          kieu: lb?.kieu ?? '',
          soHoSo,
          fieldDich: fields.join(', ') || ghiChu,
          trangThai,
        });
      }
      const bac: Record<TrangThai, number> = {
        'CÓ DỮ LIỆU CHƯA MAPPING': 0,
        'ĐÃ MAPPING': 1,
        'KỸ THUẬT — xử lý đường khác': 2,
        'RỖNG (chưa mapping)': 3,
        'RÁC — nền tảng cũ': 4,
      };
      out.sort((a, b) => bac[a.trangThai] - bac[b.trangThai] || b.soHoSo - a.soHoSo);
      tongKet[col] = dem;

      const sh = wb.addWorksheet(col.slice(0, 28));
      sh.columns = [
        { header: 'Key hệ cũ', key: 'key', width: 42 },
        { header: 'Nhãn tiếng Việt', key: 'nhan', width: 40 },
        { header: 'Kiểu', key: 'kieu', width: 12 },
        { header: 'Số hồ sơ có dữ liệu', key: 'soHoSo', width: 12 },
        { header: 'Field hệ mới đích', key: 'fieldDich', width: 34 },
        { header: 'Trạng thái', key: 'trangThai', width: 26 },
      ];
      const head = sh.getRow(1);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
      head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      head.height = 28;
      sh.views = [{ state: 'frozen', ySplit: 1 }];
      const mau: Record<TrangThai, string> = {
        'CÓ DỮ LIỆU CHƯA MAPPING': 'FFFFC7CE',
        'ĐÃ MAPPING': 'FFC6EFCE',
        'KỸ THUẬT — xử lý đường khác': 'FFDDEBF7',
        'RỖNG (chưa mapping)': 'FFF2F2F2',
        'RÁC — nền tảng cũ': 'FFEEEEEE',
      };
      for (const r of out) {
        const row = sh.addRow(r);
        row.alignment = { vertical: 'top', wrapText: true };
        row.getCell('trangThai').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mau[r.trangThai] } };
      }
    }

    await wb.xlsx.writeFile(outPath);
    console.log(`\nĐã xuất: ${outPath}\n`);
    for (const col of cols) {
      const d = tongKet[col];
      console.log(`${col}:`);
      console.log(`   đã mapping                 : ${d['ĐÃ MAPPING']}`);
      console.log(`   CÓ DỮ LIỆU CHƯA MAPPING    : ${d['CÓ DỮ LIỆU CHƯA MAPPING']}  ← cần bổ sung`);
      console.log(`   kỹ thuật (xử lý đường khác): ${d['KỸ THUẬT — xử lý đường khác']}`);
      console.log(`   rỗng (chưa mapping)        : ${d['RỖNG (chưa mapping)']}`);
      console.log(`   rác nền tảng cũ            : ${d['RÁC — nền tảng cũ']}`);
    }
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
