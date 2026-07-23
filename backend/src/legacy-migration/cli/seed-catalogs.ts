/**
 * Đưa các danh sách chọn của hệ cũ thành DANH MỤC quản lý được ở màn hình `/danh-muc`.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/seed-catalogs.ts --dry
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/seed-catalogs.ts
 *
 * Vì sao: nhiều giá trị nghiệp vụ đang là enum cứng trong mã hoặc chỉ nằm rải rác trong
 * dữ liệu, nên quản trị viên không tự thêm/sửa được. Hệ cũ có sẵn `TruongTuyChinh` —
 * **định nghĩa trường do chính người dùng cấu hình**, kèm nhãn tiếng Việt và danh sách
 * lựa chọn. Đây là nguồn chuẩn nhất để dựng danh mục, thay vì tự nghĩ ra.
 *
 * Màn hình `/danh-muc` lấy danh sách loại bằng `distinct type` (directory.service findTypes)
 * nên loại mới TỰ hiện ngay khi có dữ liệu — không phải viết màn hình riêng.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeVi } from './org-mapper';

/**
 * Tên trường hệ cũ → loại danh mục hệ mới.
 * Trường nào hệ mới ĐÃ CÓ loại tương ứng thì trỏ vào loại đó để không tạo trùng khái niệm.
 */
const TYPE_MAP: Record<string, string> = {
  nghe_nghiep: 'OCCUPATION',
  gioi_tinh: 'GENDER',
  // Cùng 8 căn cứ Điều 157 BLTTHS, hệ mới đã diễn đạt gọn hơn → KHÔNG thêm bản trùng nghĩa.
  ly_do_ra_quyet_dinh_khong_khoi_to: 'LY_DO_KHONG_KHOI_TO',
  ly_do_ra_quyet_dinh_khong_khoi_to_vu_an: 'LY_DO_KHONG_KHOI_TO',
  // KHÔNG gộp vào `CASE_CLASSIFICATION`: loại đó phân theo LĨNH VỰC (Hình sự/Kinh tế/Ma
  // túy/ANTT), còn đây là MỨC ĐỘ NGHIÊM TRỌNG theo Điều 9 BLHS — hai khái niệm khác hẳn.
  loai_toi_pham: 'MUC_DO_NGHIEM_TRONG',
  // KHÔNG gộp vào `AGE_GROUP`: loại đó chia lứa tuổi chung, còn đây chia theo TUỔI CHỊU
  // TRÁCH NHIỆM HÌNH SỰ (Điều 12 BLHS) — mốc 14/16/18 mang ý nghĩa pháp lý riêng.
  nhom_tuoi: 'NHOM_TUOI_TNHS',
  // Các danh mục hệ mới CHƯA có — tạo loại mới, quản trị viên sửa được ngay ở /danh-muc.
  phan_loai_nguon_tin_ban_dau: 'PHAN_LOAI_NGUON_TIN',
  ly_do_tam_dinh_chi: 'LY_DO_TAM_DINH_CHI_VU_VIEC',
  ly_do_tam_dinh_chi_vu_an: 'LY_DO_TAM_DINH_CHI_VU_AN',
  ly_do_tra_ho_so_dieu_tra_bo_sung: 'LY_DO_TRA_HO_SO_DTBS',
  cac_truong_hop_nguoi_pham_toi_bi_tam_giu: 'TRUONG_HOP_TAM_GIU',
  tieu_chi_khac: 'TIEU_CHI_KHAC',
};

/**
 * Loại danh mục mà hệ mới ĐÃ ĐỦ — không nhận thêm giá trị từ hệ cũ.
 *
 * `LY_DO_KHONG_KHOI_TO`: hệ mới đã có đủ 8 căn cứ Điều 157 BLTTHS và đang được dùng.
 * Bốn lựa chọn hệ cũ chỉ là cùng căn cứ đó viết dài hơn — thêm vào thì danh sách thành
 * 12 dòng cho 8 căn cứ, cán bộ chọn sẽ rối và thống kê bị tách đôi. Anh đã chốt giữ
 * nguyên; câu chữ gốc của hệ cũ vẫn còn đủ trong `legacyRaw`.
 */
const DA_DU = new Set(['LY_DO_KHONG_KHOI_TO']);

/**
 * Khoá so sánh Ý NGHĨA của một mục danh mục: bỏ dấu, bỏ dấu câu cuối câu, gộp khoảng trắng.
 * Hệ cũ hay để dấu ';' cuối mỗi lựa chọn — chỉ khác dấu câu mà tạo bản mới là sinh trùng nghĩa.
 */
function tenSoSanh(v: string): string {
  return normalizeVi(v).replace(/[;.,:]+$/, '').trim();
}

/** Mã danh mục: bỏ dấu, hoa, chỉ giữ chữ và số, tối đa 30 ký tự. */
function toCode(v: string): string {
  const base = normalizeVi(v).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return (base || 'KHAC').slice(0, 30);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const defs = await prisma.legacyStaging.findMany({
      where: { sourceFile: 'TruongTuyChinh' },
      select: { raw: true },
    });
    if (!defs.length) throw new Error('Bảng chờ chưa có TruongTuyChinh — chạy stage.ts với file đó trước.');

    // Nạp SẴN mọi mục đang có, đánh chỉ mục theo TÊN đã chuẩn hoá.
    // Khớp theo mã là sai: cùng "Công nhân" nhưng mã cũ là `CN`, còn mã sinh từ nhãn là
    // `CONG_NHAN` → bị coi như chưa có rồi tạo bản TRÙNG NGHĨA. Ý nghĩa nằm ở cái TÊN.
    const daCoTheoTen = new Map<string, Set<string>>();
    for (const d of await prisma.directory.findMany({ select: { type: true, name: true } })) {
      if (!daCoTheoTen.has(d.type)) daCoTheoTen.set(d.type, new Set());
      daCoTheoTen.get(d.type)!.add(tenSoSanh(d.name));
    }

    console.log(dryRun ? '\n— CHẠY THỬ, KHÔNG GHI GÌ —\n' : '\n— ĐÃ GHI DANH MỤC —\n');
    let tao = 0;
    let daCo = 0;
    const boQua: string[] = [];
    const themMoi: string[] = [];
    const giuNguyen: string[] = [];

    for (const d of defs) {
      const r = d.raw as Record<string, unknown>;
      const truong = String(r.ten_truong ?? '').trim();
      const opts = r.danh_sach_lua_chon;
      if (!truong || !Array.isArray(opts) || !opts.length) continue;

      const type = TYPE_MAP[truong];
      if (!type) {
        boQua.push(`${truong} (${opts.length} lựa chọn)`);
        continue;
      }
      if (DA_DU.has(type)) {
        console.log(`  ${type.padEnd(28)} ← ${String(r.ten_hien_thi ?? truong)}  ·  ĐÃ ĐỦ, không thêm`);
        continue;
      }

      const nhan = String(r.ten_hien_thi ?? truong);
      let n = 0;
      let m = 0;
      const daDung = new Set<string>();
      for (const [i, o] of opts.entries()) {
        const opt = o as Record<string, unknown>;
        const ten = String(opt.ten_hien_thi ?? opt.gia_tri ?? '').trim();
        if (!ten) continue;
        let code = toCode(ten);
        // Mã trùng trong cùng loại thì thêm hậu tố — `(type, code)` là khoá duy nhất.
        if (daDung.has(code)) code = `${code.slice(0, 27)}_${i}`;
        daDung.add(code);

        const tenChuan = tenSoSanh(ten);
        const daCo = daCoTheoTen.get(type);
        if (daCo?.has(tenChuan)) {
          m++;
          giuNguyen.push(`${type} · ${ten}`);
          continue;
        }
        // Cùng tên nhưng mã đã bị dùng cho mục khác → đổi mã, KHÔNG bỏ giá trị.
        const trungMa = await prisma.directory.findFirst({ where: { type, code }, select: { id: true } });
        if (trungMa) code = `${code.slice(0, 26)}_${i}`;
        n++;
        themMoi.push(`${type} · ${ten}`);
        daCoTheoTen.get(type)?.add(tenChuan) ?? daCoTheoTen.set(type, new Set([tenChuan]));
        if (!dryRun) {
          await prisma.directory.create({
            data: {
              type,
              code,
              name: ten,
              description: `Di trú từ danh sách chọn "${nhan}" của hệ thống cũ`,
              order: i + 1,
              isActive: true,
            },
          });
        }
      }
      tao += n;
      daCo += m;
      console.log(`  ${type.padEnd(28)} ← ${nhan}  ·  tạo mới ${n}, đã có ${m}`);
    }

    console.log(`\nTổng: tạo mới ${tao} mục, ${daCo} mục ĐÃ CÓ (giữ nguyên, không đè).`);
    if (giuNguyen.length) {
      console.log(`\nĐÃ CÓ SẴN — giữ nguyên (${giuNguyen.length}):`);
      for (const x of giuNguyen) console.log(`   = ${x}`);
    }
    if (themMoi.length) {
      console.log(`\nSẼ THÊM MỚI (${themMoi.length}):`);
      for (const x of themMoi) console.log(`   + ${x}`);
    }
    if (boQua.length) {
      console.log('\nDanh sách chọn CHƯA quyết loại danh mục (cần bổ sung vào TYPE_MAP):');
      for (const b of boQua) console.log(`   · ${b}`);
    }
    console.log('\nMở /danh-muc để xem — loại mới tự hiện vì màn hình lấy danh sách bằng distinct type.\n');
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
