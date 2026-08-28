/**
 * Sinh bảng `ten_truong -> kieu_du_lieu` của hệ cũ ra tệp TypeScript.
 *
 * ── Vì sao cần bảng này, dù đã có `field-parity.def.ts` ──
 *
 * Hai bảng phục vụ hai việc khác nhau và trộn chúng là gốc của một lớp lỗi in ấn:
 *
 *   • `field-parity.def.ts` nói trường cũ lưu vào CỘT KIỂU GÌ ở hệ mới (việc của di trú).
 *   • `TruongTuyChinh` của hệ cũ nói hệ cũ IN trường ấy ra sao (việc của bản in).
 *
 * Bốn trường tên bắt đầu bằng `ngay_` — `ngay_phieu_chuyen`, `ngay_tiep_nhan_nguon_tin`,
 * `ngay_viet_don`, `ngay_cap_cccd_nguyen_don` — hệ cũ khai là `text`, tức cán bộ gõ tay và hệ
 * cũ in NGUYÊN VĂN. Hệ mới khai chúng là `DateTime` (đúng cho cột CSDL) rồi dùng luôn kiểu ấy
 * để in, nên bản in bị chuẩn hoá `09/8/2026` thành `09/08/2026`, và 4.447 hồ sơ có nội dung
 * không phải ngày thì in ra TRỐNG (đo 28/08/2026 trên 55.067 hồ sơ).
 *
 * ── Nguồn ──
 *
 * Bản sao CSDL hệ cũ trên PostgreSQL 18 (`backup-legacy-to-postgres.ts` dựng), bảng
 * `legacy_TruongTuyChinh`, lọc `loai = 'ho_so'`. Đọc thẳng từ nguồn thay vì chép tay: 132
 * trường chép tay là 132 chỗ để lệch.
 *
 * ── Dùng ──
 *
 *   npx ts-node src/legacy-migration/cli/gen-kieu-truong-he-cu.ts
 *   npx ts-node src/legacy-migration/cli/gen-kieu-truong-he-cu.ts --check
 *
 * `--check` chỉ so tệp đã sinh với CSDL, không ghi — dùng khi có bản sao trong tay. CI không có
 * bản sao ấy nên cổng ở CI là `kieu-truong-he-cu.gate.spec.ts`: nó kiểm mọi chỗ điền của 11 mẫu
 * hệ cũ đều có kiểu, thứ chạy được mà không cần CSDL.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DICH = path.resolve(__dirname, '../../document-templates/kieu-truong-he-cu.generated.ts');

/** Kiểu dữ liệu hệ cũ khai cho một trường hồ sơ. Lấy đúng chuỗi hệ cũ lưu, không đổi tên. */
export type KieuHeCu =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multi_select'
  | 'phone'
  | 'chon_toi_danh'
  | 'chon_nhieu_toi_danh';

export async function docKieuTuCsdl(url: string): Promise<Record<string, string>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ ten: string; kieu: string }>(
      `select doc->>'ten_truong' as ten, doc->>'kieu_du_lieu' as kieu
         from legacy_TruongTuyChinh
        where doc->>'loai' = 'ho_so' and coalesce(doc->>'ten_truong', '') <> ''
        order by 1`,
    );
    const ra: Record<string, string> = {};
    for (const r of rows) ra[r.ten] = r.kieu;
    return ra;
  } finally {
    await client.end();
  }
}

export function dungNoiDung(bang: Record<string, string>): string {
  const dong = Object.keys(bang)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: '${bang[k]}',`)
    .join('\n');
  return `// TỆP SINH TỰ ĐỘNG — đừng sửa tay.
// Sinh bởi: src/legacy-migration/cli/gen-kieu-truong-he-cu.ts
// Nguồn: bản sao CSDL hệ cũ, bảng \`TruongTuyChinh\`, lọc \`loai = 'ho_so'\`.
//
// Bảng này nói hệ cũ IN một trường ra sao, KHÁC với \`field-parity.def.ts\` (nói lưu vào cột
// kiểu gì). Bản in phải theo bảng này: bốn trường tên \`ngay_*\` được hệ cũ khai là \`text\`,
// nên hệ cũ in nguyên văn thứ cán bộ gõ chứ không chuẩn hoá thành ngày.

export type KieuHeCu =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'multi_select'
  | 'phone'
  | 'chon_toi_danh'
  | 'chon_nhieu_toi_danh';

export const KIEU_TRUONG_HE_CU: Readonly<Record<string, KieuHeCu>> = {
${dong}
};
`;
}

async function main(): Promise<void> {
  const url =
    process.env['BACKUP_PG_URL'] ??
    'postgresql://postgres:postgres@127.0.0.1:5433/pc02_legacy_backup';
  const bang = await docKieuTuCsdl(url);
  const noiDung = dungNoiDung(bang);

  if (process.argv.includes('--check')) {
    const hienCo = fs.existsSync(DICH) ? fs.readFileSync(DICH, 'utf-8') : '';
    if (hienCo !== noiDung) {
      console.error('✗ kieu-truong-he-cu.generated.ts đã lệch với CSDL hệ cũ. Chạy lại bộ sinh.');
      process.exit(1);
    }
    console.log(`✓ Khớp CSDL hệ cũ — ${Object.keys(bang).length} trường.`);
    return;
  }

  fs.writeFileSync(DICH, noiDung, 'utf-8');
  console.log(`✓ Đã sinh ${Object.keys(bang).length} trường → ${DICH}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
