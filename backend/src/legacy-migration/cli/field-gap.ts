/**
 * Rà TOÀN BỘ cột của hệ cũ và lập bảng ánh xạ sang hệ mới.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/field-gap.ts
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/field-gap.ts --out "C:/PC02/bang-anh-xa.xlsx"
 *
 * Mỗi cột có dữ liệu phải rơi vào ĐÚNG MỘT nhóm — không cột nào được để "chưa xử lý":
 *   Nhóm 1 — nhánh này đã đọc, nhánh khác chưa  → chỉ cần đọc nốt
 *   Nhóm 2 — chưa builder nào đọc, hệ mới CÓ ô  → ánh xạ thẳng
 *   Nhóm 3 — chưa có ô tương ứng                → PHẢI THÊM CỘT MỚI
 *   Nhóm 0 — cột kỹ thuật của nền tảng cũ       → cố ý bỏ
 *
 * Nghĩa từng cột tra từ `TruongTuyChinh` (176 định nghĩa trường của chính hệ cũ, có nhãn
 * tiếng Việt + kiểu dữ liệu), thay vì đoán theo tên cột.
 *
 * LƯU Ý: danh sách khoá mà bộ ánh xạ đọc được lấy bằng cách ĐỌC THẲNG mã nguồn lúc chạy.
 * Đừng truyền qua file tạm ở /tmp — shell và Node hiểu đường dẫn đó khác nhau, từng làm
 * phép đo sai toàn bộ (báo nhầm mọi cột là chưa ánh xạ).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type Group = 0 | 1 | 2 | 3;

/** Cột kỹ thuật của nền tảng bán hàng cũ — không mang nghĩa nghiệp vụ. */
const TECHNICAL = new Set([
  '_id', 'id', '_add_time', '_update_time', 'da_xoa', 'da_nhan', 'stt', 'don_vi_id', 'nguoi_them',
]);

/**
 * Cột chưa builder nào đọc nhưng hệ MỚI ĐÃ CÓ ô tương ứng (nhóm 2).
 * Tra tay theo schema.prisma — mỗi dòng là một quyết định ánh xạ, không phải đoán.
 */
const GROUP2: Record<string, string> = {
  ngay_ra_quyet_dinh_khoi_to: 'Case.ngayKhoiTo',
  quyet_dinh_tam_dinh_chi_vu_an: 'Case.soQuyetDinhTamDinhChi',
  ngay_tam_dinh_chi_vu_an: 'Case.ngayTamDinhChi',
  quyet_dinh_khong_khoi_to: 'Incident.soQuyetDinhKhongKhoiTo',
  ngay_ra_quyet_dinh_khong_khoi_to: 'Incident.ngayKhongKhoiTo',
  ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an: 'Case.ngayHetThoiHieu',
  ngay_thong_ke: 'Case.metadata.ngayThongKe',
  ngay: 'ngày nghiệp vụ (ghép với thang/nam) — đã có ngay_de_xuat, dùng để đối chiếu',
  thang: 'ngày nghiệp vụ (ghép) — đối chiếu',
  nam: 'ngày nghiệp vụ (ghép) — đối chiếu',
};

/** Cột chưa có ô tương ứng ⇒ phải thêm cột mới (nhóm 3), kèm tên cột đề xuất. */
const GROUP3: Record<string, string> = {
  stt_cu: 'sttCu — số thứ tự hồ sơ ở hệ cũ, cần để tra ngược hồ sơ giấy',
  tinh_trang: 'tinhTrangHoSo — nên thành danh mục',
  phan_loai_toi_pham_theo_linh_vuc: 'phanLoaiToiPhamLinhVuc — nên thành danh mục',
  phan_loai_ho_so_doi_1: 'phanLoaiHoSoNoiBo',
  dieu_tra_vien: 'dieuTraVienText — tên điều tra viên dạng chữ, khác investigatorId',
  dieu_tra_vien_phuong_xa: 'dieuTraVienPhuongXaText',
  de_xuat: 'deXuatXuLy',
  yeu_cau_bo_sung: 'yeuCauBoSung',
  het_thoi_hieu_tnhs: 'hetThoiHieuTnhs',
  ngay_het_han_vu_an: 'ngayHetHanVuAn',
  thoi_gian_het_thoi_hieu_truy_cuu_tnhs: 'thoiGianHetThoiHieuTnhs',
  lich_su: 'bảng riêng — lịch sử chuyển đơn vị (mảng con)',
};

/** Đọc thẳng mã nguồn bộ ánh xạ để biết builder nào đọc khoá nào. */
function readMapperKeys(): { all: Set<string>; byBuilder: Record<string, Set<string>> } {
  const file = path.join(__dirname, '..', 'legacy-mapper.ts');
  const src = fs.readFileSync(file, 'utf8');
  const keysIn = (body: string): Set<string> =>
    new Set([
      ...[...body.matchAll(/rec\.([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
      ...[...body.matchAll(/rec\['([^']+)'\]/g)].map((m) => m[1]),
    ]);
  const byBuilder: Record<string, Set<string>> = {};
  for (const fn of ['buildPetition', 'buildIncident', 'buildCase', 'buildCaseStatistic']) {
    const i = src.indexOf(`function ${fn}(`);
    if (i < 0) {
      byBuilder[fn] = new Set();
      continue;
    }
    const j = src.indexOf('\nfunction ', i + 10);
    byBuilder[fn] = keysIn(src.slice(i, j > 0 ? j : src.length));
  }
  return { all: keysIn(src), byBuilder };
}

interface Row {
  col: string;
  nhan: string;
  kieu: string;
  tong: number;
  pet: number;
  inc: number;
  cse: number;
  doc: string;
  nhom: Group;
  dich: string;
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : path.join(process.cwd(), 'bang-anh-xa-cot.xlsx');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const { all, byBuilder } = readMapperKeys();
    console.log(
      `Bộ ánh xạ đọc: tổng ${all.size} khoá · Đơn thư ${byBuilder.buildPetition.size} · ` +
        `Vụ việc ${byBuilder.buildIncident.size} · Vụ án ${byBuilder.buildCase.size}`,
    );

    // Nhãn tiếng Việt + kiểu dữ liệu, lấy từ chính định nghĩa trường của hệ cũ.
    const defs = await prisma.legacyStaging.findMany({
      where: { sourceFile: 'TruongTuyChinh' },
      select: { raw: true },
    });
    const label = new Map<string, { ten: string; kieu: string }>();
    for (const d of defs) {
      const r = d.raw as Record<string, unknown>;
      const k = String(r.ten_truong ?? '').trim();
      if (k) label.set(k, { ten: String(r.ten_hien_thi ?? ''), kieu: String(r.kieu_du_lieu ?? '') });
    }
    console.log(`Định nghĩa trường tra được từ TruongTuyChinh: ${label.size}`);

    // Đếm cột có dữ liệu, tách theo loại thực thể mà hồ sơ đó đã sinh ra.
    const rows = await prisma.$queryRaw<{ raw: any; l: string }[]>`
      SELECT s.raw,
             CASE WHEN EXISTS (SELECT 1 FROM cases c     WHERE c."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'case'
                  WHEN EXISTS (SELECT 1 FROM incidents i WHERE i."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'inc'
                  WHEN EXISTS (SELECT 1 FROM petitions p WHERE p."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'pet'
                  ELSE 'none' END AS l
      FROM legacy_staging s WHERE s."sourceFile" IN ('ho_so_doi_1','ho_so')`;

    const cnt: Record<string, { tong: number; pet: number; inc: number; cse: number }> = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.raw as Record<string, unknown>)) {
        if (/_search$/.test(k)) continue;
        if (v === null || v === undefined || v === '' || v === 0 || v === false) continue;
        const c = (cnt[k] ??= { tong: 0, pet: 0, inc: 0, cse: 0 });
        c.tong++;
        if (r.l === 'case') c.cse++;
        else if (r.l === 'inc') c.inc++;
        else if (r.l === 'pet') c.pet++;
      }
    }

    const out: Row[] = [];
    for (const [col, c] of Object.entries(cnt)) {
      const inPet = byBuilder.buildPetition.has(col);
      const inInc = byBuilder.buildIncident.has(col);
      const inCse = byBuilder.buildCase.has(col) || byBuilder.buildCaseStatistic.has(col);
      const doc = [inPet ? 'Đơn thư' : '', inInc ? 'Vụ việc' : '', inCse ? 'Vụ án' : ''].filter(Boolean).join(' + ') || '(chưa)';

      let nhom: Group;
      let dich: string;
      if (TECHNICAL.has(col)) {
        nhom = 0;
        dich = 'cột kỹ thuật — cố ý bỏ';
      } else if (all.has(col)) {
        // Có builder đọc rồi. Thiếu ở nhánh nào thì là nhóm 1, đủ cả ba thì coi như xong.
        const thieu = [!inPet && c.pet > 0 ? 'Đơn thư' : '', !inInc && c.inc > 0 ? 'Vụ việc' : '', !inCse && c.cse > 0 ? 'Vụ án' : '']
          .filter(Boolean)
          .join(', ');
        nhom = thieu ? 1 : 0;
        dich = thieu ? `bổ sung cho: ${thieu}` : 'đã đủ ở các nhánh có dữ liệu';
      } else if (GROUP2[col]) {
        nhom = 2;
        dich = GROUP2[col];
      } else if (GROUP3[col]) {
        nhom = 3;
        dich = GROUP3[col];
      } else {
        // Không lọt vào bảng tra tay nào — bắt buộc phải quyết, không để lửng lơ.
        nhom = 3;
        dich = '⚠ CHƯA QUYẾT — cần chọn ô đích hoặc thêm cột mới';
      }

      const lb = label.get(col);
      out.push({
        col,
        nhan: lb?.ten ?? '',
        kieu: lb?.kieu ?? '',
        tong: c.tong,
        pet: c.pet,
        inc: c.inc,
        cse: c.cse,
        doc,
        nhom,
        dich,
      });
    }
    out.sort((a, b) => a.nhom - b.nhom || b.tong - a.tong);

    // ── Xuất Excel ─────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PC02 — rà soát ánh xạ cột';
    const sh = wb.addWorksheet('Bảng ánh xạ cột');
    sh.columns = [
      { header: 'Nhóm', key: 'nhom', width: 7 },
      { header: 'Cột hệ cũ', key: 'col', width: 40 },
      { header: 'Nhãn tiếng Việt (hệ cũ)', key: 'nhan', width: 40 },
      { header: 'Kiểu', key: 'kieu', width: 12 },
      { header: 'Số hồ sơ có dữ liệu', key: 'tong', width: 12 },
      { header: 'Đơn thư', key: 'pet', width: 9 },
      { header: 'Vụ việc', key: 'inc', width: 9 },
      { header: 'Vụ án', key: 'cse', width: 9 },
      { header: 'Nhánh ĐANG đọc', key: 'doc', width: 24 },
      { header: 'Việc cần làm / ô đích', key: 'dich', width: 60 },
    ];
    const head = sh.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    head.height = 30;
    sh.views = [{ state: 'frozen', ySplit: 1 }];
    const mau: Record<Group, string> = { 0: 'FFEEEEEE', 1: 'FFFFF2CC', 2: 'FFDDEBF7', 3: 'FFFFC7CE' };
    for (const r of out) {
      const row = sh.addRow(r);
      row.alignment = { vertical: 'top', wrapText: true };
      row.getCell('nhom').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mau[r.nhom] } };
    }

    const dem = (g: Group) => out.filter((r) => r.nhom === g).length;
    const sh2 = wb.addWorksheet('Chú giải');
    sh2.columns = [
      { header: 'Nhóm', key: 'g', width: 8 },
      { header: 'Nghĩa', key: 'm', width: 60 },
      { header: 'Số cột', key: 'n', width: 10 },
    ];
    sh2.getRow(1).font = { bold: true };
    sh2.addRow({ g: 0, m: 'Cột kỹ thuật, hoặc đã ánh xạ đủ ở mọi nhánh có dữ liệu', n: dem(0) });
    sh2.addRow({ g: 1, m: 'Nhánh này đã đọc, nhánh khác chưa → chỉ cần đọc nốt', n: dem(1) });
    sh2.addRow({ g: 2, m: 'Chưa builder nào đọc, hệ mới ĐÃ CÓ ô → ánh xạ thẳng', n: dem(2) });
    sh2.addRow({ g: 3, m: 'Chưa có ô tương ứng → PHẢI THÊM CỘT MỚI vào hệ thống', n: dem(3) });

    await wb.xlsx.writeFile(outPath);

    console.log(`\nTổng cột có dữ liệu: ${out.length}`);
    console.log(`  nhóm 0 (kỹ thuật / đã đủ)        : ${dem(0)}`);
    console.log(`  nhóm 1 (đọc nốt cho nhánh thiếu) : ${dem(1)}`);
    console.log(`  nhóm 2 (ánh xạ thẳng vào ô sẵn)  : ${dem(2)}`);
    console.log(`  nhóm 3 (phải thêm cột mới)       : ${dem(3)}`);
    const chuaQuyet = out.filter((r) => r.dich.startsWith('⚠'));
    if (chuaQuyet.length) {
      console.log(`\n⚠ ${chuaQuyet.length} cột CHƯA QUYẾT được ô đích:`);
      for (const r of chuaQuyet.slice(0, 25)) {
        console.log(`   ${String(r.tong).padStart(6)}  ${r.col.padEnd(44)} ${r.nhan}`);
      }
    }
    console.log(`\nĐã xuất: ${outPath}\n`);
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
