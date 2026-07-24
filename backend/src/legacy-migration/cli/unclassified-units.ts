/**
 * Xuất DANH SÁCH ĐƠN VỊ CHƯA PHÂN LOẠI cho anh duyệt.
 *
 * Vì sao cần: hồ sơ cũ ghi đơn vị giải quyết bằng chuỗi tự do (`don_vi_giai_quyet`). Bộ nạp
 * khớp chuỗi này với Tổ/Nhóm hệ mới bằng `teamMatchKey`. Những giá trị KHÔNG khớp Tổ nào là
 * quyết định NGHIỆP VỤ của anh — em KHÔNG tự đoán (một chuỗi có thể là Tổ nội bộ, Cơ quan
 * ngoài, hay chỉ là ghi chú kết quả). Công cụ này liệt kê chúng kèm số hồ sơ + cột trống để
 * anh điền: TỔ / CƠ QUAN NGOÀI / KẾT QUẢ / BỎ.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/unclassified-units.ts --out "C:/PC02/don-vi-chua-phan-loai.xlsx"
 */
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { teamMatchKey } from './org-mapper';

// Chỉ cột GÁN ĐƠN VỊ GIẢI QUYẾT — đây là trường quyết định hồ sơ thuộc Tổ nào. Hai cột
// `nguon_don`/`vu_viec_chuyen_don_vi_khac` là ghi chú tự do (nơi chuyển đến, diễn giải),
// không phải "đơn vị cần phân loại" nên KHÔNG đưa vào để danh sách còn rà được.
const UNIT_KEYS = ['don_vi_giai_quyet'];

interface DongDonVi {
  giaTri: string;
  soHoSo: number;
  truong: string;
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : path.join(process.cwd(), 'don-vi-chua-phan-loai.xlsx');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    // Khoá khớp của mọi Tổ đang có — giá trị nào rơi vào đây coi như ĐÃ phân loại.
    const teams = await prisma.team.findMany({ select: { name: true } });
    const teamKeys = new Set(teams.map((t) => teamMatchKey(t.name)));

    const rows = await prisma.legacyStaging.findMany({
      where: { sourceFile: { in: ['ho_so_doi_1', 'ho_so'] } },
      select: { raw: true },
    });

    // Gom theo GIÁ TRỊ GỐC (giữ nguyên chữ để anh đọc), đếm số hồ sơ, nhớ trường nguồn.
    const dem = new Map<string, DongDonVi>();
    for (const r of rows) {
      const raw = r.raw as Record<string, unknown>;
      for (const k of UNIT_KEYS) {
        const v = raw[k];
        const str = v == null ? '' : String(v).trim();
        if (!str) continue;
        if (teamKeys.has(teamMatchKey(str))) continue; // đã khớp Tổ → bỏ
        const cur = dem.get(str) ?? { giaTri: str, soHoSo: 0, truong: k };
        cur.soHoSo++;
        dem.set(str, cur);
      }
    }

    const out = [...dem.values()].sort((a, b) => b.soHoSo - a.soHoSo);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PC02 — đơn vị chưa phân loại';
    const sh = wb.addWorksheet('Đơn vị chưa phân loại');
    sh.columns = [
      { header: 'Giá trị hệ cũ', key: 'giaTri', width: 48 },
      { header: 'Trường nguồn', key: 'truong', width: 22 },
      { header: 'Số hồ sơ', key: 'soHoSo', width: 10 },
      { header: 'Quyết định (TỔ / CƠ QUAN NGOÀI / KẾT QUẢ / BỎ)', key: 'quyetDinh', width: 40 },
      { header: 'Tên Tổ đích (nếu chọn TỔ)', key: 'toDich', width: 34 },
    ];
    const head = sh.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    head.height = 30;
    sh.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of out) {
      const row = sh.addRow({ giaTri: r.giaTri, truong: r.truong, soHoSo: r.soHoSo, quyetDinh: '', toDich: '' });
      row.alignment = { vertical: 'top', wrapText: true };
    }

    await wb.xlsx.writeFile(outPath);
    const tongHoSo = out.reduce((s, r) => s + r.soHoSo, 0);
    console.log(`\nĐã xuất: ${outPath}`);
    console.log(`   Giá trị đơn vị chưa phân loại : ${out.length}`);
    console.log(`   Tổng lượt hồ sơ liên quan     : ${tongHoSo}`);
    console.log('   → Điền cột "Quyết định" rồi gửi lại để em gắn vào Tổ / đánh dấu cơ quan ngoài.\n');
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
