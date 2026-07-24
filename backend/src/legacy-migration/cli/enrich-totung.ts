/**
 * Bóc MỐC TỐ TỤNG từ tóm tắt tự do rồi ĐIỀN THẲNG vào ô đang trống của Vụ án.
 *
 * Vì sao cần: hệ cũ nhét diễn biến vào một ô văn bản, các ô nghiệp vụ để trống. Đo trên
 * vụ án đã di trú: chỉ ~2,5% có ngày khởi tố, ~5% có số QĐ khởi tố — dù thông tin nằm
 * ngay trong đoạn văn ("Ngày 27/10/2016, Công an quận Tân Bình khởi tố vụ án…").
 *
 * Anh đã chốt: "Điền thẳng vào ô + đánh dấu trích tự động". Ràng buộc — KHÔNG THƯƠNG LƯỢNG:
 *   • CHỈ điền ô ĐANG TRỐNG, không đè dữ liệu người dùng đã nhập.
 *   • Mỗi giá trị kèm ĐOẠN TRÍCH GỐC trong `metadata.trichTuDong.<ô> = { giaTri, dauVet }`
 *     để cán bộ đối chiếu và giao diện gắn nhãn "trích tự động".
 *   • Idempotent: chạy lại KHÔNG đổi gì (ô đã có giá trị → bỏ qua; đã đánh dấu → bỏ qua).
 *   • Mặc định `--dry` (chỉ báo cáo). Ghi thật khi `--apply`.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/enrich-totung.ts          # dry
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/enrich-totung.ts --apply  # ghi
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { extractNgayKhoiTo, extractSoQuyetDinhKhoiTo, extractChuyenVuAn } from './text-extract';

/** Một ô có thể điền tự động: tên ô hệ mới + hàm bóc + loại giá trị. */
type OTroTung = 'ngayKhoiTo' | 'soQuyetDinhKhoiTo' | 'chuyenVuAnChoCQK';

interface DeXuat {
  o: OTroTung;
  giaTri: Date | string;
  dauVet: string;
}

/** Nguồn văn bản để bóc: ưu tiên tóm tắt gốc hệ cũ, lùi về mô tả trong metadata. */
function nguonVanBan(legacyRaw: unknown, metadata: unknown): string {
  const raw = legacyRaw as Record<string, unknown> | null;
  const tt = raw && typeof raw.tom_tat_noi_dung === 'string' ? raw.tom_tat_noi_dung : '';
  const meta = (metadata ?? {}) as Record<string, unknown>;
  const desc = typeof meta.description === 'string' ? meta.description : '';
  return (tt || desc || '').toString();
}

/** Sinh các đề xuất điền cho MỘT vụ án — chỉ cho ô đang trống. */
export function deXuatChoVuAn(vu: {
  ngayKhoiTo: Date | null;
  soQuyetDinhKhoiTo: string | null;
  chuyenVuAnChoCQK: string | null;
  metadata: unknown;
  legacyRaw: unknown;
}): DeXuat[] {
  const text = nguonVanBan(vu.legacyRaw, vu.metadata);
  if (text.trim().length < 20) return [];

  const meta = (vu.metadata ?? {}) as Record<string, unknown>;
  const daTrich = (meta.trichTuDong ?? {}) as Record<string, unknown>;
  const out: DeXuat[] = [];

  // Đã có dấu trích tự động cho ô này ⇒ đã xử lý lần trước ⇒ bỏ qua (idempotent).
  if (!vu.ngayKhoiTo && !daTrich.ngayKhoiTo) {
    const kt = extractNgayKhoiTo(text);
    if (kt.date) out.push({ o: 'ngayKhoiTo', giaTri: kt.date, dauVet: kt.trace! });
  }
  if (!vu.soQuyetDinhKhoiTo && !daTrich.soQuyetDinhKhoiTo) {
    const so = extractSoQuyetDinhKhoiTo(text);
    if (so.so) out.push({ o: 'soQuyetDinhKhoiTo', giaTri: so.so, dauVet: so.trace! });
  }
  if (!vu.chuyenVuAnChoCQK && !daTrich.chuyenVuAnChoCQK) {
    const cv = extractChuyenVuAn(text);
    if (cv.noiDung) out.push({ o: 'chuyenVuAnChoCQK', giaTri: cv.noiDung, dauVet: cv.trace! });
  }
  return out;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    // Vụ án đã di trú lọc theo legacyRaw ở vòng lặp (JSON null-filter khó diễn đạt an toàn).
    const cases = await prisma.case.findMany({
      select: {
        id: true,
        ngayKhoiTo: true,
        soQuyetDinhKhoiTo: true,
        chuyenVuAnChoCQK: true,
        metadata: true,
        legacyRaw: true,
      },
    });

    const dem: Record<OTroTung, number> = { ngayKhoiTo: 0, soQuyetDinhKhoiTo: 0, chuyenVuAnChoCQK: 0 };
    let soVuChinhSua = 0;

    for (const vu of cases) {
      if (!vu.legacyRaw) continue; // chỉ vụ án di trú
      const deXuat = deXuatChoVuAn(vu);
      if (!deXuat.length) continue;
      soVuChinhSua++;

      const data: Record<string, unknown> = {};
      const meta = (vu.metadata ?? {}) as Record<string, unknown>;
      const trichTuDong = { ...((meta.trichTuDong ?? {}) as Record<string, unknown>) };

      for (const d of deXuat) {
        dem[d.o]++;
        data[d.o] = d.giaTri;
        trichTuDong[d.o] = {
          giaTri: d.giaTri instanceof Date ? d.giaTri.toISOString().slice(0, 10) : d.giaTri,
          dauVet: d.dauVet,
        };
      }
      data.metadata = { ...meta, trichTuDong };

      if (apply) {
        await prisma.case.update({ where: { id: vu.id }, data });
      }
    }

    const che = apply ? 'ĐÃ GHI' : 'THỬ (dry — thêm --apply để ghi)';
    console.log(`\nBóc mốc tố tụng — ${che}`);
    console.log(`   Số vụ án quét            : ${cases.length}`);
    console.log(`   Số vụ được bổ sung       : ${soVuChinhSua}`);
    console.log(`   → Ngày khởi tố           : ${dem.ngayKhoiTo}`);
    console.log(`   → Số QĐ khởi tố          : ${dem.soQuyetDinhKhoiTo}`);
    console.log(`   → Chuyển vụ án cho CQĐT  : ${dem.chuyenVuAnChoCQK}`);
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
