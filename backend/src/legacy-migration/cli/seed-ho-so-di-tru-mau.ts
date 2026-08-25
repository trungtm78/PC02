/**
 * seed-ho-so-di-tru-mau.ts — dựng MỘT hồ sơ vụ án mang bản gốc hệ cũ, để đối chiếu tay.
 *
 * Dùng cho dòng E5 của `UAT-COVERAGE.md`: mở hồ sơ ĐÃ DI TRÚ ở chế độ Sửa và xem các ô hệ
 * cũ có hiện dữ liệu không. Hồ sơ mẫu gắn với tài khoản chỉ định để nằm trong phạm vi dữ
 * liệu của người đăng nhập — không thì danh sách rỗng và không mở ra được.
 *
 * Hồ sơ tạo ra CỐ Ý chỉ có `legacyRaw`, không điền sẵn cột nào: đúng cảnh hồ sơ di trú
 * trước khi hệ thống có các cột mới. Chạy `backfill-parity.ts` xong mới có dữ liệu.
 *
 * Dùng: set -a && source .env && set +a
 *       ./node_modules/.bin/ts-node src/legacy-migration/cli/seed-ho-so-di-tru-mau.ts [--email admin@pc02.local]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const MA_HO_SO = 'DI-TRU-MAU-01';
const T = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const HO_SO_HE_CU: Record<string, unknown> = {
  id: 880_001,
  __sourceCollection: 'ho_so_doi_1',
  phan_loai_nguon_tin_ban_dau: 'Vụ án',
  tom_tat_noi_dung:
    'Hồ sơ di trú mẫu — dùng để đối chiếu tay các ô hệ cũ trên form Vụ án của hệ mới.',
  ngay_de_xuat: T('2026-03-12T00:00:00Z'),
  nguon_don: 'Bưu điện',
  loai_thong_tin: 'Tố giác',
  so_phieu_chuyen: 'PC-1204',
  ngay_phieu_chuyen: T('2026-03-10T00:00:00Z'),
  ngay_tiep_nhan_nguon_tin: T('2026-03-11T00:00:00Z'),
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Nguyễn Thị Hoa',
  so_dien_thoai_nguyen_don: '0901234567',
  'dia-chi-bi-hai': '12 Lê Lợi, Phường Bến Nghé',
  nghi_van_doi_tuong: 'Chưa rõ đối tượng',
  'toi-danh-ban-dau': 'Lừa đảo chiếm đoạt tài sản',
  noi_xay_ra: 'Quận 1',
  do_vat_tai_lieu_kem_theo: 'Đơn tố giác, CCCD photo, sao kê ngân hàng',
  ngay_viet_don: T('2026-03-09T00:00:00Z'),
  nhan_xet: 'Có dấu hiệu tội phạm, số tiền bị chiếm đoạt khoảng 800 triệu.',
  ghi_chu_trung_don: 'Không trùng đơn',
  truong_hop_bao_cao_ban_giam_doc: 'Đã báo cáo Ban Giám đốc ngày 13/3',
  ngay_giao_don_vi_giai_quyet: T('2026-03-13T00:00:00Z'),
  lanh_dao_to_tung: 'Trần Văn Bình',
  dieu_tra_vien: 'Lê Minh Quân',
  // Tab Vụ việc / Vụ việc TĐC / Vật chứng
  quyet_dinh_phan_cong_giai_quyet_nguon_tin: '45/QD-PC02',
  ngay_ra_quyet_dinh_phan_cong_tin_bao: T('2026-03-14T00:00:00Z'),
  vat_chung: '01 điện thoại iPhone 13, 01 thẻ ngân hàng',
  lenh_nhap_kho: 'PN 88 ngày 15/3/2026',
  Noi_luu_tru_bao_quan_ke_bien_phong_toa: 'Kho vật chứng PC02',
  // Mốc thống kê — nhóm 16.9k–17.8k hồ sơ trước nay kẹt trong legacy_raw
  ngay_thong_ke: T('2026-03-31T00:00:00Z'),
  ngay_tiep_nhan_tin: T('2026-03-11T00:00:00Z'),
  ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi: T('2026-03-12T00:00:00Z'),
  ngay_xay_ra: T('2026-03-01T00:00:00Z'),
  so_luong_bi_hai: '2',
  so_tien_bi_thiet_hai: '800',
};

async function main(): Promise<void> {
  const i = process.argv.indexOf('--email');
  const email = i >= 0 ? process.argv[i + 1] : 'admin@pc02.local';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`Không thấy tài khoản ${email}`);

    await prisma.caseStatistic.deleteMany({ where: { case: { caseCode: MA_HO_SO } } });
    await prisma.case.deleteMany({ where: { caseCode: MA_HO_SO } });

    const c = await prisma.case.create({
      data: {
        name: 'Hồ sơ di trú mẫu — Lừa đảo chiếm đoạt tài sản',
        caseCode: MA_HO_SO,
        caseProvenance: 'DIRECT_DISCOVERY',
        // Gắn với người dùng để hồ sơ nằm trong phạm vi dữ liệu của họ.
        createdById: user.id,
        investigatorId: user.id,
        legacySourceId: `ho_so_doi_1:${String(HO_SO_HE_CU.id)}`,
        legacyId: HO_SO_HE_CU.id as number,
        legacyCollection: 'ho_so_doi_1',
        legacyRaw: HO_SO_HE_CU as never,
      },
      select: { id: true, caseCode: true },
    });

    console.log(`Đã tạo hồ sơ di trú mẫu: ${c.caseCode} (id=${c.id}), gắn cho ${email}.`);
    console.log('Chạy tiếp: ts-node src/legacy-migration/cli/backfill-parity.ts --entity case');
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
