/**
 * backfill-ma-ho-so.ts — bù MÃ HỒ SƠ cho CẢ BA loại hồ sơ di trú còn thiếu hoặc mang mã tạm.
 *
 * PHÁT HIỆN TRONG LÚC UAT ngày 25/08/2026, khi cột mã bắt đầu hiện rõ trên danh sách:
 *   • 76/3.380 vụ án KHÔNG có mã (`caseCode` rỗng) — cán bộ thấy một ô trống
 *   • 125/4.717 vụ việc mang mã tạm `VV-LEGACY-<khoá nguồn>`
 *   • và MỖI LƯỢT NHẬP lại sinh thêm đơn thư mã tạm `DT-LEGACY-…` (29 hồ sơ sau lượt bù
 *     trưa 25/08). Vì vậy MỘT công cụ lo cả ba — hai công cụ riêng thì chạy cái này quên
 *     cái kia là chuyện chắc chắn xảy ra, đúng cách sự cố bộ đếm sáng nay sống sót.
 *
 * Đây là khoảng trống dữ liệu CÓ SẴN từ trước, không do bản vá danh sách gây ra; nó chỉ lộ
 * ra vì trước đây cột mã không được hiện.
 *
 * QUY TẮC SUY TỪ DỮ LIỆU, KHÔNG PHẢI TỪ GIẢ ĐỊNH: đối chiếu 8 mẫu ngẫu nhiên trong nhóm vụ
 * án đã có mã cho thấy `<nam>-<stt>` — dùng trường `stt`, KHÔNG phải `stt_cu` (vd `2019-125`
 * có nam=2019, stt=125, stt_cu=81). Cùng quy tắc đã dùng cho 1.333 đơn thư.
 *
 * • Chỉ đụng hồ sơ ĐANG THIẾU mã hoặc mang mã tạm — không bao giờ đè mã đã cấp.
 * • Mã là @unique: trùng thì thêm hậu tố `-2`, `-3`… thay vì ném lỗi giữa chừng.
 * • Duyệt theo `legacySourceId` để chạy lại cho kết quả y hệt.
 * • Sau khi gán, NÂNG BỘ ĐẾM — bỏ bước này là tái tạo sự cố không lưu được hồ sơ sáng nay.
 * • MẶC ĐỊNH CHỈ ĐỌC; `--apply` mới ghi.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/backfill-ma-ho-so.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { napLaiBoDem } from './repair-document-counters';

/** Năm hồ sơ hợp lý. Ngoài khoảng này gần như chắc chắn là lỗi gõ (đã gặp năm 3023). */
const NAM_MIN = 1900;
const NAM_MAX = 2100;

/** Mã cơ sở từ bản thô hệ cũ, hoặc undefined khi thiếu dữ kiện. Không đoán. */
export function maTuBanTho(raw: Record<string, unknown> | null | undefined): string | undefined {
  if (!raw) return undefined;
  const n = raw['nam'] == null ? '' : String(raw['nam']).trim();
  const s = raw['stt'] == null ? '' : String(raw['stt']).trim();
  if (!/^\d{4}$/.test(n) || !/^\d+$/.test(s)) return undefined;
  const nam = Number(n);
  if (nam < NAM_MIN || nam > NAM_MAX) return undefined;
  return `${n}-${s}`;
}

/** Mã duy nhất: giữ nguyên nếu chưa ai dùng, không thì thêm hậu tố tăng dần. */
export function capMaDuyNhat(base: string, daDung: Set<string>): string {
  if (!daDung.has(base)) {
    daDung.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const ma = `${base}-${i}`;
    if (!daDung.has(ma)) {
      daDung.add(ma);
      return ma;
    }
  }
}

/** Mã tạm mà đường nhập đặt lúc tạo, chờ một bước cấp mã chạy sau. */
function laMaTam(ma: string | null): boolean {
  return ma == null || ma === '' || ma.includes('-LEGACY-');
}

/**
 * Bù mã cho hồ sơ đang mang mã tạm, rồi nâng bộ đếm số cho khớp.
 *
 * Tách khỏi `main()` để BỘ CẬP NHẬT gọi lại được ngay sau khi nạp. Đường nhập đặt mã tạm
 * `DT-LEGACY-…` lúc tạo và chờ bước này cấp mã thật — quên gọi thì hồ sơ vừa nạp mang mã
 * vô nghĩa, cán bộ tra theo mã hệ cũ không thấy. Đúng chuyện đã xảy ra ngày 28/08/2026 với
 * 83 đơn thư mới.
 */
export async function buMaHoSo(prisma: PrismaClient, apply: boolean): Promise<void> {
  console.log(`\n=== Bù mã hồ sơ — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`);

  {
    // ── Vụ án ───────────────────────────────────────────────────────────────
    const maVuAnDaDung = new Set(
      (await prisma.case.findMany({ select: { caseCode: true } }))
        .map((c) => c.caseCode)
        .filter((v): v is string => !!v),
    );

    const vuAnThieu = (
      await prisma.case.findMany({
        where: { deletedAt: null },
        select: { id: true, caseCode: true, legacyRaw: true, legacySourceId: true },
        orderBy: { legacySourceId: 'asc' },
      })
    ).filter((c) => laMaTam(c.caseCode));

    let vuAnCap = 0;
    let vuAnBoQua = 0;
    const viDuVuAn: string[] = [];

    for (const c of vuAnThieu) {
      const base = maTuBanTho(c.legacyRaw as Record<string, unknown> | null);
      if (!base) {
        vuAnBoQua++;
        continue;
      }
      const ma = capMaDuyNhat(base, maVuAnDaDung);
      if (viDuVuAn.length < 5) viDuVuAn.push(`${c.caseCode ?? '(trống)'} → ${ma}`);
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { caseCode: ma } });
      vuAnCap++;
    }

    console.log(`VỤ ÁN   : ${vuAnThieu.length} hồ sơ thiếu mã · ${apply ? 'đã cấp' : 'sẽ cấp'} ${vuAnCap} · bỏ qua ${vuAnBoQua}`);
    if (viDuVuAn.length) console.log(`  ${viDuVuAn.join('\n  ')}`);

    // ── Vụ việc ─────────────────────────────────────────────────────────────
    const maVuViecDaDung = new Set(
      (await prisma.incident.findMany({ select: { code: true } })).map((i) => i.code),
    );

    const vuViecThieu = (
      await prisma.incident.findMany({
        where: { deletedAt: null },
        select: { id: true, code: true, legacyRaw: true, legacySourceId: true },
        orderBy: { legacySourceId: 'asc' },
      })
    ).filter((i) => laMaTam(i.code));

    let vuViecCap = 0;
    let vuViecBoQua = 0;
    const viDuVuViec: string[] = [];

    for (const i of vuViecThieu) {
      const base = maTuBanTho(i.legacyRaw as Record<string, unknown> | null);
      if (!base) {
        vuViecBoQua++;
        continue;
      }
      const ma = capMaDuyNhat(base, maVuViecDaDung);
      if (viDuVuViec.length < 5) viDuVuViec.push(`${i.code} → ${ma}`);
      if (apply) await prisma.incident.update({ where: { id: i.id }, data: { code: ma } });
      vuViecCap++;
    }

    console.log(`\nVỤ VIỆC : ${vuViecThieu.length} hồ sơ mã tạm · ${apply ? 'đã cấp' : 'sẽ cấp'} ${vuViecCap} · bỏ qua ${vuViecBoQua}`);
    if (viDuVuViec.length) console.log(`  ${viDuVuViec.join('\n  ')}`);
    if (vuViecBoQua) {
      console.log(
        `  (${vuViecBoQua} hồ sơ KHÔNG suy được mã — phần lớn đến từ collection\n` +
          `   TamDinhChi_vu_viec_21 của hệ cũ, vốn không có "nam"/"stt". Không đoán.)`,
      );
    }


    // ── Đơn thư ─────────────────────────────────────────────────────────────
    const maDonThuDaDung = new Set(
      (await prisma.petition.findMany({ select: { stt: true } })).map((p) => p.stt),
    );

    const donThuThieu = (
      await prisma.petition.findMany({
        where: { deletedAt: null },
        select: { id: true, stt: true, legacyRaw: true, legacySourceId: true },
        orderBy: { legacySourceId: 'asc' },
      })
    ).filter((p) => laMaTam(p.stt));

    // Một số đơn thư di trú là VỎ LIÊN KẾT: bản thô được định tuyến sang vụ án hoặc vụ việc
    // cùng khoá nguồn, nên `legacyRaw` để trống. Dữ kiện cấp mã vẫn có — chỉ nằm ở thực thể
    // anh em. Lấy từ đó thay vì bỏ cuộc.
    const khoaThieuRaw = donThuThieu
      .filter((p) => !p.legacyRaw && p.legacySourceId)
      .map((p) => p.legacySourceId!);
    const rawAnhEm = new Map<string, Record<string, unknown>>();
    if (khoaThieuRaw.length) {
      for (const c of await prisma.case.findMany({
        where: { legacySourceId: { in: khoaThieuRaw } },
        select: { legacySourceId: true, legacyRaw: true },
      })) {
        if (c.legacySourceId && c.legacyRaw) {
          rawAnhEm.set(c.legacySourceId, c.legacyRaw as Record<string, unknown>);
        }
      }
      for (const i of await prisma.incident.findMany({
        where: { legacySourceId: { in: khoaThieuRaw } },
        select: { legacySourceId: true, legacyRaw: true },
      })) {
        if (i.legacySourceId && i.legacyRaw && !rawAnhEm.has(i.legacySourceId)) {
          rawAnhEm.set(i.legacySourceId, i.legacyRaw as Record<string, unknown>);
        }
      }
    }

    let donThuCap = 0;
    let donThuBoQua = 0;
    const viDuDonThu: string[] = [];

    for (const p of donThuThieu) {
      const raw =
        (p.legacyRaw as Record<string, unknown> | null) ??
        (p.legacySourceId ? rawAnhEm.get(p.legacySourceId) : undefined) ??
        null;
      const base = maTuBanTho(raw);
      if (!base) {
        donThuBoQua++;
        continue;
      }
      const ma = capMaDuyNhat(base, maDonThuDaDung);
      if (viDuDonThu.length < 5) viDuDonThu.push(`${p.stt} → ${ma}`);
      if (apply) await prisma.petition.update({ where: { id: p.id }, data: { stt: ma } });
      donThuCap++;
    }

    console.log(
      `
ĐƠN THƯ : ${donThuThieu.length} hồ sơ mã tạm · ${apply ? 'đã cấp' : 'sẽ cấp'} ${donThuCap} · bỏ qua ${donThuBoQua}`,
    );
    if (viDuDonThu.length) console.log(`  ${viDuDonThu.join('\n  ')}`);

    // ── Bộ đếm ──────────────────────────────────────────────────────────────
    // BẮT BUỘC: công cụ này ghi thẳng vào cột mã, đi vòng qua bộ sinh số. Không nâng bộ đếm
    // thì lần cấp số kế tiếp rơi trúng mã vừa gán — đúng sự cố đã chặn cả buổi sáng 25/08.
    console.log(`\n--- Nạp lại bộ đếm số ---`);
    const boDem = await napLaiBoDem(prisma, apply);
    const daNang = boDem.filter((b) => b.canSua);
    if (!daNang.length) console.log('Không bộ đếm nào tụt lại.');
    else {
      for (const b of daNang) console.log(`  ${b.ten} kỳ ${b.periodKey}: ${b.boDemCu} → ${b.boDemMoi}`);
      console.log(`${apply ? 'Đã nâng' : 'Sẽ nâng'} ${daNang.length} bộ đếm.`);
    }

    if (!apply) console.log(`\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)`);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    await buMaHoSo(prisma, process.argv.includes('--apply'));
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
