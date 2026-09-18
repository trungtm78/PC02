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
 * • Mã là @unique. Trùng hồ sơ DI TRÚ khác thì thêm hậu tố `-2`, `-3`…; trùng hồ sơ HỆ MỚI tạo
 *   thì cấp số mới theo bộ đếm và giữ số hệ cũ ở STT cũ (18/09/2026, xem `buMotLoai`).
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
import { DocumentNumbersService } from '../../document-numbers/document-numbers.service';

/** Năm hồ sơ hợp lý. Ngoài khoảng này gần như chắc chắn là lỗi gõ (đã gặp năm 3023). */
const NAM_MIN = 1900;
const NAM_MAX = 2100;

/** Số/chuỗi Mongo → chuỗi đã cắt; kiểu khác (đối tượng, mảng) coi như trống — không đoán. */
function chuoiNguyenThuy(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

/** Mã cơ sở từ bản thô hệ cũ, hoặc undefined khi thiếu dữ kiện. Không đoán. */
export function maTuBanTho(
  raw: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  const n = chuoiNguyenThuy(raw['nam']);
  const s = chuoiNguyenThuy(raw['stt']);
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

/** Loại bộ đếm số hệ mới — bộ đếm TÁCH theo loại, nên trùng chỉ xét trong cùng loại. */
export type LoaiSo = 'CASE' | 'INCIDENT' | 'PETITION';

/**
 * Cấp số mới theo bộ đếm hệ mới cho hồ sơ `id` — trong MỘT giao dịch. `soHeCu` khác null thì ghi
 * vào STT cũ; null khi STT cũ đã có giá trị riêng (không ghi đè). Trả số vừa cấp.
 */
export type GhiSoMoi = (
  loai: LoaiSo,
  id: string,
  soHeCu: string | null,
) => Promise<string>;

export interface TuyChonBuMa {
  /** Mặc định: `taoGhiSoMoi(prisma, <ADMIN đầu tiên>)`. Ca kiểm truyền bản giả. */
  ghiSoMoi?: GhiSoMoi;
  /** Năm của kỳ bộ đếm (mặc định năm hiện tại). Ca kiểm cố định để không phụ thuộc ngày chạy. */
  namBoDem?: number;
}

export interface KetQuaMotLoai {
  thieu: number;
  cap: number;
  boQua: number;
  /** Hồ sơ trùng số với hồ sơ HỆ MỚI tạo → đã/sẽ nhận số mới theo bộ đếm. */
  soMoi: Array<{ id: string; soHeCu: string; ma: string }>;
  /**
   * Trùng số hệ mới, đã cấp số mới, nhưng STT cũ ĐÃ có giá trị riêng nên không ghi đè — số hệ cũ
   * chỉ còn trong bản thô (`legacyRaw.nam/stt`). Không để trống mã: mã trống là lỗi công cụ này sinh
   * ra để vá (rà mã 18/09/2026).
   */
  sttCuDaCo: Array<{ id: string; soHeCu: string }>;
}

export interface KetQuaBuMa {
  vuAn: KetQuaMotLoai;
  vuViec: KetQuaMotLoai;
  donThu: KetQuaMotLoai;
}

interface DongCanMa {
  id: string;
  ma: string | null;
  raw: Record<string, unknown> | null;
  sttCu: string | null;
}

const SO_MOI_CHAY_THU = '(số mới từ bộ đếm)';

/**
 * Cấp mã cho MỘT loại hồ sơ.
 *
 *   mã cơ sở (năm-stt hệ cũ)
 *     ├─ chưa ai dùng ──────────────────────────────► giữ nguyên
 *     ├─ trùng hồ sơ DI TRÚ khác, hoặc năm ≠ năm bộ đếm ► hậu tố -2, -3 (giữ đúng năm)
 *     └─ trùng số HỆ MỚI (hồ sơ hệ mới tạo, hoặc số bộ đếm đã cấp cho hồ sơ di trú)
 *          └─────────────────────────────────────► số mới theo bộ đếm + STT cũ = mã cơ sở
 *                                                   (STT cũ đã có riêng thì giữ, không ghi đè)
 */
async function buMotLoai(opts: {
  ten: string;
  loai: LoaiSo;
  /** Mã đang dùng → có phải hồ sơ hệ mới tạo (không có khoá nguồn hệ cũ) không. */
  maDangDung: Map<string, boolean>;
  canMa: DongCanMa[];
  ghiMa: (id: string, ma: string) => Promise<unknown>;
  ghiSoMoi: () => Promise<GhiSoMoi>;
  apply: boolean;
  namBoDem: number;
}): Promise<KetQuaMotLoai> {
  const { ten, loai, maDangDung, canMa, ghiMa, apply, namBoDem } = opts;
  const kq: KetQuaMotLoai = {
    thieu: canMa.length,
    cap: 0,
    boQua: 0,
    soMoi: [],
    sttCuDaCo: [],
  };
  const daDung = new Set(maDangDung.keys());
  const viDu: string[] = [];

  for (const h of canMa) {
    const base = maTuBanTho(h.raw);
    if (!base) {
      kq.boQua++;
      continue;
    }
    // Bộ đếm cấp số theo NĂM HIỆN TẠI: số gốc năm khác mà cấp số bộ đếm là đổi năm của hồ sơ.
    const cungNamBoDem = base.startsWith(`${namBoDem}-`);
    if (maDangDung.get(base) === true && cungNamBoDem) {
      const sttCuDaCo = !!h.sttCu?.trim();
      const ma = apply
        ? await (
            await opts.ghiSoMoi()
          )(loai, h.id, sttCuDaCo ? null : base)
        : SO_MOI_CHAY_THU;
      if (apply) {
        daDung.add(ma);
        // Số vừa cấp là số HỆ MỚI: hồ sơ hệ cũ phát sau mang đúng số này cũng phải nhận số mới,
        // không được rơi vào nhánh hậu tố (rà mã 18/09/2026).
        maDangDung.set(ma, true);
      }
      kq.soMoi.push({ id: h.id, soHeCu: base, ma });
      if (sttCuDaCo) kq.sttCuDaCo.push({ id: h.id, soHeCu: base });
      kq.cap++;
      continue;
    }
    const ma = capMaDuyNhat(base, daDung);
    if (!maDangDung.has(ma)) maDangDung.set(ma, false);
    if (viDu.length < 5) viDu.push(`${h.ma ?? '(trống)'} → ${ma}`);
    if (apply) await ghiMa(h.id, ma);
    kq.cap++;
  }

  console.log(
    `\n${ten}: ${kq.thieu} hồ sơ thiếu mã/mã tạm · ${apply ? 'đã cấp' : 'sẽ cấp'} ${kq.cap} · bỏ qua ${kq.boQua}`,
  );
  if (viDu.length) console.log(`  ${viDu.join('\n  ')}`);
  if (kq.soMoi.length) {
    console.log(
      `  ${kq.soMoi.length} hồ sơ trùng số HỆ MỚI → số mới theo bộ đếm, số hệ cũ vào STT cũ:`,
    );
    for (const s of kq.soMoi) console.log(`    ${s.soHeCu} → ${s.ma}`);
  }
  if (kq.sttCuDaCo.length) {
    console.log(
      `  ${kq.sttCuDaCo.length} hồ sơ đã có STT cũ riêng nên KHÔNG ghi số hệ cũ vào STT cũ (số hệ cũ còn trong bản thô): ` +
        kq.sttCuDaCo.map((x) => `${x.id}=${x.soHeCu}`).join(', '),
    );
  }
  return kq;
}

/**
 * Mã có phải số HỆ MỚI không: hồ sơ hệ mới tạo (không khoá nguồn hệ cũ), hoặc hồ sơ di trú đã được
 * cấp số theo bộ đếm (mã khác năm-stt trong bản thô của nó). Hồ sơ di trú không có bản thô (vỏ liên
 * kết) coi như giữ số hệ cũ.
 */
export function laSoHeMoi(d: {
  ma: string | null;
  legacySourceId: string | null;
  raw: Record<string, unknown> | null;
}): boolean {
  if (!d.ma) return false;
  if (d.legacySourceId == null) return true;
  if (!d.raw) return false;
  const goc = maTuBanTho(d.raw);
  return !!goc && d.ma !== goc && !d.ma.startsWith(`${goc}-`);
}

/** Mã → có số HỆ MỚI nào đang giữ mã ấy không (xem `laSoHeMoi`). */
function banDoMa(
  dong: Array<{
    ma: string | null;
    legacySourceId: string | null;
    raw: Record<string, unknown> | null;
  }>,
): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const d of dong) {
    if (!d.ma) continue;
    m.set(d.ma, m.get(d.ma) === true || laSoHeMoi(d));
  }
  return m;
}

/**
 * Cấp số qua CHÍNH dịch vụ bộ đếm dùng khi tạo hồ sơ thường (khoá dòng bộ đếm, lưới chống lệch,
 * nhật ký cấp số) — không tự viết lại cách cấp số.
 */
export function taoGhiSoMoi(prisma: PrismaClient, actorId: string): GhiSoMoi {
  const docNums = new DocumentNumbersService(prisma as never);
  return (loai, id, soHeCu) =>
    prisma.$transaction(async (tx) => {
      const sttCu = soHeCu === null ? {} : { sttCu: soHeCu };
      const { number } = await docNums.commitWithTx(
        loai,
        { userId: actorId },
        tx,
        { documentId: id },
      );
      if (loai === 'CASE')
        await tx.case.update({
          where: { id },
          data: { caseCode: number, ...sttCu },
        });
      else if (loai === 'INCIDENT')
        await tx.incident.update({
          where: { id },
          data: { code: number, ...sttCu },
        });
      else
        await tx.petition.update({
          where: { id },
          data: { stt: number, ...sttCu },
        });
      return number;
    });
}

/** Người chạy di trú — ghi vào nhật ký cấp số. Cùng cách `cap-nhat-tu-he-cu` chọn. */
export async function timNguoiChayDiTru(prisma: PrismaClient): Promise<string> {
  // Sắp theo ngày tạo: nhật ký cấp số ghi CÙNG một người qua các lần chạy.
  const admin = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    where: { role: { name: 'ADMIN' } },
    select: { id: true },
  });
  if (!admin)
    throw new Error(
      'Không tìm thấy tài khoản ADMIN để ghi nhận người chạy di trú.',
    );
  return admin.id;
}

/**
 * Bù mã cho hồ sơ đang mang mã tạm, rồi nâng bộ đếm số cho khớp.
 *
 * Tách khỏi `main()` để BỘ CẬP NHẬT gọi lại được ngay sau khi nạp. Đường nhập đặt mã tạm
 * `DT-LEGACY-…` lúc tạo và chờ bước này cấp mã thật — quên gọi thì hồ sơ vừa nạp mang mã
 * vô nghĩa, cán bộ tra theo mã hệ cũ không thấy. Đúng chuyện đã xảy ra ngày 28/08/2026 với
 * 83 đơn thư mới.
 *
 * 18/09/2026: hệ cũ vẫn chạy song song và cấp số trùng với số hệ mới đã cấp. Trùng với hồ sơ HỆ
 * MỚI thì cấp số mới theo bộ đếm và giữ số hệ cũ ở STT cũ (anh chốt) — xem `buMotLoai`.
 */
export async function buMaHoSo(
  prisma: PrismaClient,
  apply: boolean,
  tuyChon: TuyChonBuMa = {},
): Promise<KetQuaBuMa> {
  console.log(
    `\n=== Bù mã hồ sơ — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`,
  );

  let ghiSoMoiDaTao: GhiSoMoi | undefined = tuyChon.ghiSoMoi;
  const namBoDem = tuyChon.namBoDem ?? new Date().getFullYear();
  const ghiSoMoi = async (): Promise<GhiSoMoi> => {
    ghiSoMoiDaTao ??= taoGhiSoMoi(prisma, await timNguoiChayDiTru(prisma));
    return ghiSoMoiDaTao;
  };

  // ── Vụ án ───────────────────────────────────────────────────────────────
  const vuAnTatCa = await prisma.case.findMany({
    select: {
      id: true,
      caseCode: true,
      legacyRaw: true,
      legacySourceId: true,
      sttCu: true,
      deletedAt: true,
    },
    orderBy: { legacySourceId: 'asc' },
  });
  const vuAn = await buMotLoai({
    ten: 'VỤ ÁN   ',
    loai: 'CASE',
    maDangDung: banDoMa(
      vuAnTatCa.map((c) => ({
        ma: c.caseCode,
        legacySourceId: c.legacySourceId,
        raw: c.legacyRaw as Record<string, unknown> | null,
      })),
    ),
    canMa: vuAnTatCa
      .filter((c) => !c.deletedAt && laMaTam(c.caseCode))
      .map((c) => ({
        id: c.id,
        ma: c.caseCode,
        raw: c.legacyRaw as Record<string, unknown> | null,
        sttCu: c.sttCu,
      })),
    ghiMa: (id, ma) =>
      prisma.case.update({ where: { id }, data: { caseCode: ma } }),
    ghiSoMoi,
    apply,
    namBoDem,
  });

  // ── Vụ việc ─────────────────────────────────────────────────────────────
  const vuViecTatCa = await prisma.incident.findMany({
    select: {
      id: true,
      code: true,
      legacyRaw: true,
      legacySourceId: true,
      sttCu: true,
      deletedAt: true,
    },
    orderBy: { legacySourceId: 'asc' },
  });
  const vuViec = await buMotLoai({
    ten: 'VỤ VIỆC ',
    loai: 'INCIDENT',
    maDangDung: banDoMa(
      vuViecTatCa.map((i) => ({
        ma: i.code,
        legacySourceId: i.legacySourceId,
        raw: i.legacyRaw as Record<string, unknown> | null,
      })),
    ),
    canMa: vuViecTatCa
      .filter((i) => !i.deletedAt && laMaTam(i.code))
      .map((i) => ({
        id: i.id,
        ma: i.code,
        raw: i.legacyRaw as Record<string, unknown> | null,
        sttCu: i.sttCu,
      })),
    ghiMa: (id, ma) =>
      prisma.incident.update({ where: { id }, data: { code: ma } }),
    ghiSoMoi,
    apply,
    namBoDem,
  });
  if (vuViec.boQua) {
    console.log(
      `  (${vuViec.boQua} hồ sơ KHÔNG suy được mã — phần lớn đến từ collection\n` +
        `   TamDinhChi_vu_viec_21 của hệ cũ, vốn không có "nam"/"stt". Không đoán.)`,
    );
  }

  // ── Đơn thư ─────────────────────────────────────────────────────────────
  const donThuTatCa = await prisma.petition.findMany({
    select: {
      id: true,
      stt: true,
      legacyRaw: true,
      legacySourceId: true,
      sttCu: true,
      deletedAt: true,
    },
    orderBy: { legacySourceId: 'asc' },
  });
  const donThuThieu = donThuTatCa.filter((p) => !p.deletedAt && laMaTam(p.stt));

  // Một số đơn thư di trú là VỎ LIÊN KẾT: bản thô được định tuyến sang vụ án hoặc vụ việc
  // cùng khoá nguồn, nên `legacyRaw` để trống. Dữ kiện cấp mã vẫn có — chỉ nằm ở thực thể
  // anh em. Lấy từ đó thay vì bỏ cuộc.
  const khoaThieuRaw = donThuThieu
    .filter((p) => !p.legacyRaw && p.legacySourceId)
    .map((p) => p.legacySourceId as string);
  const rawAnhEm = new Map<string, Record<string, unknown>>();
  if (khoaThieuRaw.length) {
    for (const c of await prisma.case.findMany({
      where: { legacySourceId: { in: khoaThieuRaw } },
      select: { legacySourceId: true, legacyRaw: true },
    })) {
      if (c.legacySourceId && c.legacyRaw)
        rawAnhEm.set(c.legacySourceId, c.legacyRaw as Record<string, unknown>);
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
  const donThu = await buMotLoai({
    ten: 'ĐƠN THƯ ',
    loai: 'PETITION',
    maDangDung: banDoMa(
      donThuTatCa.map((p) => ({
        ma: p.stt,
        legacySourceId: p.legacySourceId,
        raw: p.legacyRaw as Record<string, unknown> | null,
      })),
    ),
    canMa: donThuThieu.map((p) => ({
      id: p.id,
      ma: p.stt,
      raw:
        (p.legacyRaw as Record<string, unknown> | null) ??
        (p.legacySourceId ? rawAnhEm.get(p.legacySourceId) : undefined) ??
        null,
      sttCu: p.sttCu,
    })),
    ghiMa: (id, ma) =>
      prisma.petition.update({ where: { id }, data: { stt: ma } }),
    ghiSoMoi,
    apply,
    namBoDem,
  });

  // ── Bộ đếm ──────────────────────────────────────────────────────────────
  // BẮT BUỘC: đường giữ nguyên/hậu tố ghi thẳng vào cột mã, đi vòng qua bộ sinh số. Không nâng
  // bộ đếm thì lần cấp số kế tiếp rơi trúng mã vừa gán — đúng sự cố đã chặn cả buổi sáng 25/08.
  console.log(`\n--- Nạp lại bộ đếm số ---`);
  const boDem = await napLaiBoDem(prisma, apply);
  const daNang = boDem.filter((b) => b.canSua);
  if (!daNang.length) console.log('Không bộ đếm nào tụt lại.');
  else {
    for (const b of daNang)
      console.log(`  ${b.ten} kỳ ${b.periodKey}: ${b.boDemCu} → ${b.boDemMoi}`);
    console.log(`${apply ? 'Đã nâng' : 'Sẽ nâng'} ${daNang.length} bộ đếm.`);
  }

  if (!apply)
    console.log(`\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)`);
  return { vuAn, vuViec, donThu };
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
