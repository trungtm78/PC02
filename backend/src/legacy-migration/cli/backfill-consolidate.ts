/**
 * backfill-consolidate.ts — Consolidate epic (feat/consolidate-legacy-native-fields).
 *
 * Đưa giá trị đang nằm trong `Case.metadata` JSON (live store lâu nay) LÊN cột typed
 * chính thức (canonical mới). Xử lý 3 nhóm:
 *   - Cặp GỘP (native metadata ↔ old): meta.reporter | meta.tenCungCap → cột tenCungCap …
 *   - Field native thăng cột (N): meta.receiveDate → cột receiveDate …
 *   - Damage/victim: meta.damageAmount | meta.stat_damageAmount → case_statistics.soTienBiThietHai …
 *
 * AN TOÀN (Codex P1):
 *   - CHỈ set khi cột đang NULL (idempotent, không đè giá trị đã có / sửa tay / backfill-parity).
 *   - Cột đã có giá trị KHÁC candidate → KHÔNG đè, ghi CONFLICT (anh review).
 *   - Giá trị không parse được (số/ngày) → ghi REJECT, bỏ qua (không bịa).
 *   - metadata KHÔNG bị xóa (lưới an toàn). legacyRaw không đụng.
 *   - Report conflict/reject ra file JSON để anh soát.
 *
 * Dùng:  set -a && source .env && set +a
 *        ./node_modules/.bin/ts-node src/legacy-migration/cli/backfill-consolidate.ts [--dry] [--out <path>]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';

const LEGACY_EPOCH_MIN = 946684800; // 2000-01-01
const LEGACY_EPOCH_MAX = 2524608000; // 2050-01-01

/** Cột String đơn giản trên Case: candidate = key native (ưu tiên) rồi key cũ. */
const STRING_COLS: Array<{ col: string; keys: string[] }> = [
  { col: 'tenCungCap', keys: ['reporter', 'tenCungCap'] },
  { col: 'cccdCungCap', keys: ['reporterIdNumber', 'cccdCungCap'] },
  { col: 'sdtCungCap', keys: ['reporterPhone', 'sdtCungCap'] },
  { col: 'diaChiCungCap', keys: ['reporterAddress', 'diaChiCungCap'] },
  { col: 'moTaChiTiet', keys: ['description', 'moTaChiTiet'] },
  { col: 'noiCapCccd', keys: ['noiCapCccd'] },
  { col: 'nguonDon', keys: ['nguonDon'] },
  { col: 'noiXayRa', keys: ['specificAddress', 'noiXayRa'] },
  { col: 'nghiVanDoiTuong', keys: ['nghiVanDoiTuong'] },
  { col: 'nhanXet', keys: ['nhanXet'] },
  { col: 'phuongThucThuDoan', keys: ['phuongThucThuDoan'] },
  { col: 'ketQuaXuLyKhac', keys: ['ketQuaXuLyKhac'] },
  { col: 'soPhieuChuyen', keys: ['soPhieuChuyen'] },
  { col: 'doVatTaiLieuKemTheo', keys: ['doVatTaiLieuKemTheo'] },
  { col: 'ghiChuTrungDon', keys: ['ghiChuTrungDon'] },
  { col: 'lanhDaoToTung', keys: ['lanhDaoToTung'] },
  { col: 'dieuTraVien', keys: ['dieuTraVienText', 'dieuTraVien'] },
  { col: 'phanLoaiToiPhamLinhVuc', keys: ['phanLoaiToiPhamLinhVuc'] },
  { col: 'phanLoaiHoSoNoiBo', keys: ['phanLoaiHoSoNoiBo'] },
  { col: 'deXuat', keys: ['deXuatXuLy', 'deXuat'] },
  { col: 'yeuCauBoSung', keys: ['yeuCauBoSung'] },
  { col: 'sttCu', keys: ['sttCu'] },
  { col: 'soHoSoCu', keys: ['soHoSoCu'] },
  // Native (N) → cột mới:
  { col: 'caseClassification', keys: ['caseClassification'] },
  { col: 'tinhTrang', keys: ['tinhTrang'] },
  { col: 'toiDanhBanDau', keys: ['toiDanhBanDau'] },
];

/** Cột Date trên Case. */
const DATE_COLS: Array<{ col: string; keys: string[] }> = [
  { col: 'ngayDeXuat', keys: ['ngayDeXuat'] },
  { col: 'ngayCapCccd', keys: ['ngayCapCccd'] },
  { col: 'ngayPhieuChuyen', keys: ['ngayPhieuChuyen'] },
  { col: 'ngayVietDon', keys: ['ngayVietDon'] },
  { col: 'ngayGiaoDonViGiaiQuyet', keys: ['ngayGiaoDonViGiaiQuyet'] },
  { col: 'receiveDate', keys: ['receiveDate'] },
];

const BOOL_COLS: Array<{ col: string; keys: string[] }> = [
  { col: 'baoCaoBanGiamDoc', keys: ['baoCaoBanGiamDoc'] },
];

/** Damage/victim → case_statistics. */
const STAT_NUM: Array<{ col: string; keys: string[]; int: boolean }> = [
  { col: 'soTienBiThietHai', keys: ['damageAmount', 'stat_damageAmount', 'soTienBiThietHai'], int: false },
  { col: 'soLuongBiHai', keys: ['stat_victimCount', 'soLuongBiHai'], int: true },
];

type Conflict = { caseId: string; col: string; colValue: unknown; metaValue: unknown };
type Reject = { caseId: string; col: string; raw: unknown; reason: string };

function firstPresent(meta: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = meta[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

export function parseDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  // Unix timestamp giây (hệ cũ, sau +50400s offset đã xử lý ở nơi khác — ở đây nhận ISO hoặc epoch)
  if (/^\d{9,10}$/.test(s)) {
    const n = Number(s);
    if (n >= LEGACY_EPOCH_MIN && n <= LEGACY_EPOCH_MAX) return new Date(n * 1000);
    return null;
  }
  // Định dạng VN dd/mm/yyyy hoặc dd-mm-yyyy (metadata form ghi kiểu này) → lưu date-only UTC.
  const vn = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (vn) {
    const day = Number(vn[1]);
    const mon = Number(vn[2]);
    const yr = Number(vn[3]);
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12 && yr >= 1900 && yr <= 2100) {
      return new Date(Date.UTC(yr, mon - 1, day));
    }
    return null;
  }
  // ISO yyyy-mm-dd... (chỉ nhận khi bắt đầu bằng năm 4 số, tránh nhầm dd-mm-yyyy)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Parse ngày sinh: date đầy đủ → precision 'date'; năm-only ("1985") → YYYY-01-01 + 'year'. */
export function parseDob(raw: unknown): { date: Date; precision: 'year' | 'date' } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  if (/^\d{4}$/.test(s)) {
    const y = Number(s);
    if (y >= 1900 && y <= 2100) return { date: new Date(Date.UTC(y, 0, 1)), precision: 'year' };
    return null;
  }
  const d = parseDate(s);
  return d ? { date: d, precision: 'date' } : null;
}

export function parseNum(raw: unknown, _int: boolean): number | null {
  if (raw == null) return null;
  // Nếu đã là number (metadata v0.39 lưu damageAmount dạng số) → dùng thẳng.
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  // VN dùng '.' NGĂN NGHÌN (5.500.000 = 5,5 triệu), tiền VND/đếm KHÔNG có thập phân
  // → bỏ MỌI ký tự không phải chữ số (và dấu '-' đầu). Tránh parseFloat hiểu '.' là thập phân.
  const neg = /^\s*-/.test(String(raw));
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits) * (neg ? -1 : 1);
  return isNaN(n) ? null : n;
}

export function parseBool(raw: unknown): boolean | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'có', 'x'].includes(s)) return true;
  if (['false', '0', 'no', 'không', ''].includes(s)) return false;
  return null;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : 'consolidate-report.json';
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  const conflicts: Conflict[] = [];
  const rejects: Reject[] = [];
  let scanned = 0;
  let caseCellsSet = 0;
  let statCellsSet = 0;
  let casesUpdated = 0;
  let statsUpserted = 0;

  try {
    const BATCH = 1000;
    let cursor: string | undefined;
    for (;;) {
      const rows: any[] = await (prisma as any).case.findMany({
        where: { metadata: { not: null } },
        select: {
          id: true,
          metadata: true,
          ...Object.fromEntries([...STRING_COLS, ...DATE_COLS, ...BOOL_COLS].map((c) => [c.col, true])),
          reporterDateOfBirth: true,
          reporterDateOfBirthPrecision: true,
          statistic: { select: { soTienBiThietHai: true, soLuongBiHai: true } },
        },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        scanned++;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const data: Record<string, unknown> = {};

        const applyScalar = (col: string, candidate: unknown, parsed: unknown, isReject: boolean) => {
          if (candidate === undefined) return;
          if (isReject) {
            rejects.push({ caseId: row.id, col, raw: candidate, reason: 'unparseable' });
            return;
          }
          if (parsed === null) return;
          if (row[col] === null || row[col] === undefined) {
            data[col] = parsed;
          } else if (String(row[col]) !== String(parsed)) {
            conflicts.push({ caseId: row.id, col, colValue: row[col], metaValue: parsed });
          }
        };

        for (const { col, keys } of STRING_COLS) {
          const cand = firstPresent(meta, keys);
          applyScalar(col, cand, cand === undefined ? null : String(cand).trim(), false);
        }
        for (const { col, keys } of DATE_COLS) {
          const cand = firstPresent(meta, keys);
          if (cand === undefined) continue;
          const p = parseDate(cand);
          applyScalar(col, cand, p, p === null);
        }
        for (const { col, keys } of BOOL_COLS) {
          const cand = firstPresent(meta, keys);
          if (cand === undefined) continue;
          const p = parseBool(cand);
          applyScalar(col, cand, p, p === null);
        }
        // reporterDateOfBirth (merge sinhNamCungCap year-only + reporterDateOfBirth date)
        {
          const cand = firstPresent(meta, ['reporterDateOfBirth', 'sinhNamCungCap']);
          if (cand !== undefined) {
            const dob = parseDob(cand);
            if (dob === null) {
              rejects.push({ caseId: row.id, col: 'reporterDateOfBirth', raw: cand, reason: 'unparseable-dob' });
            } else if (row.reporterDateOfBirth === null || row.reporterDateOfBirth === undefined) {
              data['reporterDateOfBirth'] = dob.date;
              data['reporterDateOfBirthPrecision'] = dob.precision;
            } else if (row.reporterDateOfBirth.getTime?.() !== dob.date.getTime()) {
              conflicts.push({ caseId: row.id, col: 'reporterDateOfBirth', colValue: row.reporterDateOfBirth, metaValue: dob.date });
            }
          }
        }

        if (Object.keys(data).length > 0) {
          caseCellsSet += Object.keys(data).length;
          casesUpdated++;
          if (!dry) await (prisma as any).case.update({ where: { id: row.id }, data });
        }

        // Damage/victim → case_statistics (upsert row nếu thiếu)
        const statData: Record<string, number> = {};
        for (const { col, keys, int } of STAT_NUM) {
          const cand = firstPresent(meta, keys);
          if (cand === undefined) continue;
          const p = parseNum(cand, int);
          if (p === null) {
            rejects.push({ caseId: row.id, col: `statistic.${col}`, raw: cand, reason: 'unparseable-num' });
            continue;
          }
          const existing = row.statistic?.[col];
          if (existing === null || existing === undefined) {
            statData[col] = p;
          } else if (existing !== p) {
            conflicts.push({ caseId: row.id, col: `statistic.${col}`, colValue: existing, metaValue: p });
          }
        }
        if (Object.keys(statData).length > 0) {
          statCellsSet += Object.keys(statData).length;
          statsUpserted++;
          if (!dry) {
            await (prisma as any).caseStatistic.upsert({
              where: { caseId: row.id },
              create: { caseId: row.id, ...statData },
              update: statData,
            });
          }
        }
      }
      cursor = rows[rows.length - 1].id;
      if (scanned % 5000 < BATCH) console.log(`  scanned ${scanned}, cases+${casesUpdated}, stats+${statsUpserted}, conflicts ${conflicts.length}, rejects ${rejects.length}${dry ? ' (DRY)' : ''}`);
      if (rows.length < BATCH) break;
    }

    const report = {
      dry,
      scanned,
      casesUpdated,
      caseCellsSet,
      statsUpserted,
      statCellsSet,
      conflictCount: conflicts.length,
      rejectCount: rejects.length,
      conflicts: conflicts.slice(0, 500),
      rejects: rejects.slice(0, 500),
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n=== backfill-consolidate ${dry ? '(DRY-RUN) ' : ''}xong ===`);
    console.log(`scanned=${scanned} cases+${casesUpdated}(cells ${caseCellsSet}) stats+${statsUpserted}(cells ${statCellsSet})`);
    console.log(`CONFLICT=${conflicts.length} (cột đã có giá trị KHÁC metadata — KHÔNG đè, anh review) REJECT=${rejects.length} (không parse được)`);
    console.log(`Report: ${outPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Chỉ chạy khi execute trực tiếp (không chạy khi import trong test).
if (require.main === module) {
  void main();
}
