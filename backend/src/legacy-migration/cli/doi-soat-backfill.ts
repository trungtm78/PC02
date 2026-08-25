/**
 * doi-soat-backfill.ts — đếm ô CÓ DỮ LIỆU trước và sau khi chạy công cụ bù.
 *
 * Chạy công cụ bù xong mà chỉ nhìn dòng "updated N" thì không biết ô nào thật sự được điền.
 * Tệp này đếm từng cột trên toàn bộ vụ án có bản gốc hệ cũ, để so trước-sau bằng số.
 *
 * CHỈ ĐỌC — không sửa gì.
 *
 * Dùng: set -a && source .env && set +a
 *       ./node_modules/.bin/ts-node src/legacy-migration/cli/doi-soat-backfill.ts
 *       thêm --json để xuất máy đọc được (dùng cho so trước-sau).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Cột trên `cases` mà epic bố cục form quan tâm. */
const COT_CASE = [
  'ngayDeXuat', 'moTaChiTiet', 'nguonDon', 'loaiThongTin', 'ngayTiepNhan',
  'soPhieuChuyen', 'ngayPhieuChuyen', 'tenCungCap', 'sdtCungCap', 'diaChiCungCap',
  'nghiVanDoiTuong', 'toiDanhBanDau', 'noiXayRa', 'doVatTaiLieuKemTheo', 'ngayVietDon',
  'nhanXet', 'ghiChuTrungDon', 'baoCaoBanGiamDocText', 'ngayGiaoDonViGiaiQuyet',
  'dieuTraVien', 'lanhDaoToTung', 'ketQuaXuLyKhac', 'ghiChuKhac',
  'phanLoaiNguonTinBanDau', 'ngayXayRa', 'noiXayRaPhuongXa',
  'soQDPhanCongNguonTin', 'ngayQDPhanCongNguonTin', 'soQDKhongKhoiTo', 'ngayQDKhongKhoiTo',
  'canCuKhongKhoiTo', 'chuyenVuViecDonViKhac', 'nhapVaoVuViecSo', 'phanLoaiDanSu',
  'vuViecTamDungTruoc2015', 'soQDTamDinhChiNguonTin', 'ngayQDTamDinhChiNguonTin',
  'canCuTamDinhChiNguonTin', 'ngayHetThoiHieuVuViec', 'khacPhucLyDoTDCVuViec',
  'tienDoKhacPhucTDCVuViec', 'soPhucHoiNguonTin', 'ngayPhucHoiNguonTin',
  'vatChungMoTa', 'lenhNhapKho', 'noiLuuTruBaoQuan',
  'tdcKhacPhucBienBan', 'tdcKhacPhucLyDoBienPhap', 'soQuyetDinhPhucHoi', 'ngayPhucHoi',
] as const;

/** Cột trên `case_statistics`. */
const COT_STAT = [
  'ngayThongKe', 'ngayPhanCongGiaiQuyetToGiac', 'ngayTiepNhanTin', 'ngayDauThu',
  'ngayPhamToiQuaTang', 'ngayBatKhanCap', 'ngayPhatHienDauHieu',
  'suDungVuKhiNong', 'soDoiTuongVPHC', 'soNguoiBiPhatTien', 'tongTienPhatHanhChinh',
  'soDoiTuongSuuTraHiemNghi', 'tongSoBienBanGhiLoiKhai', 'soBienBanGhiLoiKhaiCoGhiAm',
  'tongSoBienBanHoiCung', 'tongSoBienBanHoiCungCoGhiAm', 'soBiCanCoGhiAm',
  'soBiCanVksYeuCauGhiAm', 'soLuongBiHai', 'soTienBiThietHai',
] as const;

/**
 * Đổi tên trường Prisma sang tên cột THẬT trong cơ sở dữ liệu.
 *
 * Một số cột khai `@map` sang dạng gạch dưới (`loaiThongTin` → `loai_thong_tin`). Đoán tên
 * là hỏng câu truy vấn, nên tra thẳng `information_schema` rồi khớp: đúng tên, hoặc dạng
 * gạch dưới của nó. Cột nào không tìm thấy thì báo ra, không âm thầm bỏ qua.
 */
function snake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function traTenCot(
  muon: readonly string[],
  coThat: Set<string>,
): { map: Record<string, string>; thieu: string[] } {
  const map: Record<string, string> = {};
  const thieu: string[] = [];
  for (const f of muon) {
    if (coThat.has(f)) map[f] = f;
    else if (coThat.has(snake(f))) map[f] = snake(f);
    else thieu.push(f);
  }
  return { map, thieu };
}

function bangDem(map: Record<string, string>, bang: string, dieuKien: string): string {
  const ve = Object.entries(map)
    .map(([f, c]) => `count("${c}")::int as "${f}"`)
    .join(', ');
  return `select ${ve} from ${bang} ${dieuKien}`;
}

async function main(): Promise<void> {
  const raJson = process.argv.includes('--json');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const tong = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n from cases where legacy_raw is not null`,
    );
    const soVuAn = tong[0]?.n ?? 0;

    const cotThat = async (bang: string): Promise<Set<string>> => {
      const r = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `select column_name from information_schema.columns where table_name = '${bang}'`,
      );
      return new Set(r.map((x) => x.column_name));
    };
    const mapCase = traTenCot(COT_CASE, await cotThat('cases'));
    const mapStat = traTenCot(COT_STAT, await cotThat('case_statistics'));
    if (mapCase.thieu.length || mapStat.thieu.length) {
      console.error('CẢNH BÁO — không thấy cột:', [...mapCase.thieu, ...mapStat.thieu].join(', '));
    }

    const [caseRow] = await prisma.$queryRawUnsafe<Record<string, number>[]>(
      bangDem(mapCase.map, 'cases', 'where legacy_raw is not null'),
    );
    const [statRow] = await prisma.$queryRawUnsafe<Record<string, number>[]>(
      bangDem(
        mapStat.map,
        'case_statistics s',
        'join cases c on c.id = s."caseId" where c.legacy_raw is not null',
      ),
    );
    const soDongStat = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n from case_statistics s
       join cases c on c.id = s."caseId" where c.legacy_raw is not null`,
    );

    const ketQua = {
      soVuAnCoBanGoc: soVuAn,
      soDongThongKe: soDongStat[0]?.n ?? 0,
      cases: caseRow ?? {},
      caseStatistics: statRow ?? {},
    };

    if (raJson) {
      console.log(JSON.stringify(ketQua, null, 2));
      return;
    }

    console.log(`Vụ án có bản gốc hệ cũ: ${soVuAn}`);
    console.log(`Dòng thống kê của nhóm ấy: ${ketQua.soDongThongKe}\n`);
    const in1 = (ten: string, r: Record<string, number>, cols: readonly string[]) => {
      console.log(`── ${ten} ──`);
      for (const c of cols) {
        const n = r[c] ?? 0;
        const pct = soVuAn > 0 ? ((n / soVuAn) * 100).toFixed(1) : '0.0';
        const canh = n === 0 ? '   ← TRỐNG HOÀN TOÀN' : '';
        console.log(`  ${c.padEnd(30)} ${String(n).padStart(6)}  (${pct.padStart(5)}%)${canh}`);
      }
      console.log('');
    };
    in1('cases', ketQua.cases, COT_CASE);
    in1('case_statistics', ketQua.caseStatistics, COT_STAT);
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
