/**
 * verify-backfill-parity.ts — kiểm chứng ĐẦU-CUỐI công cụ bù trên cơ sở dữ liệu thật.
 *
 * Ca kiểm đơn vị chứng minh hàm tính đúng; tệp này chứng minh CẢ ĐƯỜNG ỐNG đúng: ghi một
 * hồ sơ mang bản gốc hệ cũ, chạy `backfill-parity.ts`, đọc lại từng cột. Không có bước này
 * thì "hàm xanh" và "dữ liệu vào được cột" vẫn là hai chuyện khác nhau.
 *
 * Chỉ đụng đúng hồ sơ nó tự tạo, và dọn sạch khi xong.
 *
 * Dùng: set -a && source .env && set +a
 *       ./node_modules/.bin/ts-node src/legacy-migration/cli/verify-backfill-parity.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { execFileSync } from 'child_process';
import * as path from 'path';

const MA_KIEM_CHUNG = 'VERIFY-BACKFILL-PARITY';
const T = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const HO_SO_HE_CU: Record<string, unknown> = {
  id: 999_999,
  phan_loai_nguon_tin_ban_dau: 'Vụ án',
  tom_tat_noi_dung: 'Hồ sơ kiểm chứng công cụ bù dữ liệu',
  ngay_thong_ke: T('2026-08-10T00:00:00Z'),
  ngay_tiep_nhan_tin: T('2026-08-01T00:00:00Z'),
  ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi: T('2026-08-06T00:00:00Z'),
  so_luong_bi_hai: '3',
  vat_chung: '01 điện thoại iPhone 13',
  lenh_nhap_kho: 'PN 33 ngày 06/8',
  Noi_luu_tru_bao_quan_ke_bien_phong_toa: 'Kho vật chứng PC02',
  quyet_dinh_khong_khoi_to: '05/QD-KKT',
  ngay_ra_quyet_dinh_khong_khoi_to: T('2026-08-03T00:00:00Z'),
  nhap_vao_vu_viec_so: '2026-1122',
  ngay_xay_ra: T('2026-07-30T00:00:00Z'),
};

/** Cột trên `cases` phải có giá trị sau khi bù. */
const COT_CASE: Record<string, unknown> = {
  phanLoaiNguonTinBanDau: 'Vụ án',
  vatChungMoTa: '01 điện thoại iPhone 13',
  lenhNhapKho: 'PN 33 ngày 06/8',
  noiLuuTruBaoQuan: 'Kho vật chứng PC02',
  soQDKhongKhoiTo: '05/QD-KKT',
  nhapVaoVuViecSo: '2026-1122',
};
const COT_CASE_NGAY: Record<string, string> = {
  ngayXayRa: '2026-07-30',
  ngayQDKhongKhoiTo: '2026-08-03',
};
/** Cột trên `case_statistics` phải có giá trị sau khi bù. */
const COT_STAT_NGAY: Record<string, string> = {
  ngayThongKe: '2026-08-10',
  ngayTiepNhanTin: '2026-08-01',
  ngayPhatHienDauHieu: '2026-08-06',
};

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const loi: string[] = [];
  let caseId: string | undefined;

  try {
    await prisma.caseStatistic.deleteMany({ where: { case: { caseCode: MA_KIEM_CHUNG } } });
    await prisma.case.deleteMany({ where: { caseCode: MA_KIEM_CHUNG } });

    // Cố ý KHÔNG điền cột nào ngoài bản gốc — đúng cảnh hồ sơ di trú trước khi có cột.
    const created = await prisma.case.create({
      data: {
        name: 'Hồ sơ kiểm chứng công cụ bù dữ liệu',
        caseCode: MA_KIEM_CHUNG,
        caseProvenance: 'DIRECT_DISCOVERY',
        legacyRaw: HO_SO_HE_CU as never,
      },
      select: { id: true },
    });
    caseId = created.id;

    // Gọi qua `node` + tệp js của ts-node: trên Windows `node_modules/.bin/ts-node` là kịch
    // bản shell, `execFileSync` không chạy được.
    execFileSync(
      process.execPath,
      [
        path.resolve(__dirname, '../../../node_modules/ts-node/dist/bin.js'),
        path.resolve(__dirname, 'backfill-parity.ts'),
        '--entity',
        'case',
      ],
      { stdio: 'inherit', cwd: path.resolve(__dirname, '../../..') },
    );

    const sau = await prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      include: { statistic: true },
    });
    const c = sau as unknown as Record<string, unknown>;

    for (const [cot, mong] of Object.entries(COT_CASE)) {
      if (c[cot] !== mong) loi.push(`cases.${cot} = ${String(c[cot])} (mong: ${String(mong)})`);
    }
    for (const [cot, mong] of Object.entries(COT_CASE_NGAY)) {
      const v = c[cot] as Date | null;
      const thuc = v ? v.toISOString().slice(0, 10) : 'null';
      if (thuc !== mong) loi.push(`cases.${cot} = ${thuc} (mong: ${mong})`);
    }
    const st = sau.statistic as unknown as Record<string, unknown> | null;
    if (!st) {
      loi.push('case_statistics: KHÔNG tạo được dòng nào');
    } else {
      for (const [cot, mong] of Object.entries(COT_STAT_NGAY)) {
        const v = st[cot] as Date | null;
        const thuc = v ? v.toISOString().slice(0, 10) : 'null';
        if (thuc !== mong) loi.push(`case_statistics.${cot} = ${thuc} (mong: ${mong})`);
      }
      if (st.soLuongBiHai !== 3) loi.push(`case_statistics.soLuongBiHai = ${String(st.soLuongBiHai)} (mong: 3)`);
    }
  } finally {
    if (caseId) {
      await prisma.caseStatistic.deleteMany({ where: { caseId } });
      await prisma.case.delete({ where: { id: caseId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }

  if (loi.length > 0) {
    console.error('\nKIỂM CHỨNG THẤT BẠI:');
    for (const l of loi) console.error('  - ' + l);
    process.exit(1);
  }
  console.log('\nKIỂM CHỨNG ĐẠT — mọi cột đã nhận dữ liệu từ bản gốc hệ cũ.');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
