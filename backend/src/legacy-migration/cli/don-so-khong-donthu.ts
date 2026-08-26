/**
 * don-so-khong-donthu.ts — trả ô số bị chuyển nhầm thành 0 về TRỐNG.
 *
 * VÌ SAO: hệ cũ tự điền `"0"` vào ô số để trống, và bộ chuyển dữ liệu trước 26/08/2026 đọc nó
 * thành con số. Đo trên máy chạy: 30.089 đơn thư ghi `soTienBiThietHai = 0` và 30.956 đơn ghi
 * `soLuongBiHai = 0`, trong khi hệ cũ chỉ 1.447 và 599 hồ sơ mang số thật khác 0.
 *
 * Trong hồ sơ pháp lý, "thiệt hại 0 đồng" là một KHẲNG ĐỊNH còn "chưa có số liệu" là chưa
 * biết — báo cáo thống kê đang cộng nhầm hai nhóm ấy. Anh chốt ngày 26/08/2026: coi là chưa
 * có số liệu.
 *
 * KHÔNG dọn theo kiểu "hễ bằng 0 thì xoá": mỗi hồ sơ đều soi lại bản gốc trong `legacyRaw`.
 * Cán bộ gõ "0 người" là chủ ý ghi số không — giá trị ấy giữ nguyên.
 *
 * AN TOÀN:
 *   - Chỉ đụng hai cột `soTienBiThietHai` và `soLuongBiHai` của bảng `petitions`.
 *   - Chỉ đụng hồ sơ ĐỐI CHIẾU ĐƯỢC bản gốc hệ cũ. Hồ sơ nhập tay (không có bản gốc) nằm
 *     ngoài phạm vi. Đơn thư di trú không giữ `legacyRaw` riêng thì tra sang vụ án / vụ việc
 *     cùng khoá nguồn — 95 hồ sơ như vậy trên máy thật.
 *   - Bỏ qua hồ sơ cán bộ ĐÃ TỪNG sửa chính hai ô số này (theo nhật ký thay đổi). Phép lọc
 *     này cố ý THÔ: nó chỉ có thể dọn THIẾU chứ không thể dọn NHẦM. Đo trên máy thật, cả hệ
 *     chỉ có 37 đơn thư từng được sửa, nên cái giá của sự thô ấy tối đa là 37/31.021.
 *   - `--dry` (bắt buộc chạy trước) chỉ đếm, không ghi.
 *   - Đếm riêng số ô DỌN và số ô GIỮ, để đối chiếu với số đo trước khi chạy — lệch nhiều
 *     nghĩa là phép chọn sai, dừng lại thay vì chạy tiếp.
 *
 * LÙI LẠI: bằng bản `pg_dump` chụp ngay trước khi chạy. Thao tác này đổi dữ liệu trên 30
 * nghìn hồ sơ nên phải có bản sao RIÊNG cho nó, không dùng chung bản sao trước lúc deploy.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/don-so-khong-donthu.ts --dry
 *       ts-node src/legacy-migration/cli/don-so-khong-donthu.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { laSoKhongDoChuyenNham } from '../don-so-khong.util';

/** Cột số của Đơn thư và khoá gốc tương ứng ở hệ cũ. */
const CAP_COT_KHOA = [
  { col: 'soTienBiThietHai', field: 'so_tien_bi_thiet_hai' },
  { col: 'soLuongBiHai', field: 'so_luong_bi_hai' },
] as const;

const BATCH = 1000;

interface KetQua {
  quet: number;
  hoSoSua: number;
  /** Hồ sơ bỏ qua vì không tìm được bản gốc hệ cũ ở đâu cả. */
  boQuaViKhongCoBanGoc: number;
  /** Hồ sơ bỏ qua vì cán bộ đã từng sửa tay chính hai ô số này. */
  boQuaVieDaSuaTay: number;
  oDon: Record<string, number>;
  oGiuVicoDonVi: Record<string, number>;
}

/**
 * Hồ sơ mà CÁN BỘ đã từng sửa chính hai ô số này — tuyệt đối không đụng tới.
 *
 * Bản gốc trong `legacyRaw` chỉ nói lên ô ấy vốn trống ở HỆ CŨ. Nếu sau khi di trú cán bộ
 * chủ ý gõ số 0 thật vào, thì con số ấy là một khẳng định nghiệp vụ — dọn mất là thay nó
 * bằng "chưa biết". `updatedAt` không dùng được làm dấu hiệu: mọi bản ghi di trú đều đã bị
 * chạm bởi chính các lần bù dữ liệu (đo trên máy thật: 31.021/31.021).
 *
 * Nhật ký thay đổi mới là dấu hiệu đúng.
 */
async function hoSoDaSuaTay(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ subjectId: string }[]>`
    select distinct "subjectId" from audit_logs
    where action = 'PETITION_UPDATED'
      and (metadata::text ilike '%soTienBiThietHai%' or metadata::text ilike '%soLuongBiHai%')
      and "subjectId" is not null`;
  return new Set(rows.map((r) => r.subjectId));
}

/**
 * Bản gốc hệ cũ của những đơn thư KHÔNG giữ `legacyRaw` riêng.
 *
 * Một số đơn thư di trú là VỎ LIÊN KẾT: bản thô được định tuyến sang vụ án hoặc vụ việc cùng
 * khoá nguồn, nên `legacyRaw` của chính nó để trống. Dữ kiện vẫn còn — chỉ nằm ở thực thể anh
 * em. Lấy từ đó thay vì bỏ cuộc: đo trên máy thật có 95 hồ sơ như vậy đang mang ô số bằng 0.
 */
async function banGocTuAnhEm(
  prisma: PrismaClient,
): Promise<Map<string, Record<string, unknown>>> {
  const thieu = await prisma.petition.findMany({
    where: {
      legacyRaw: { equals: Prisma.DbNull },
      legacySourceId: { not: null },
      OR: [{ soTienBiThietHai: 0 }, { soLuongBiHai: 0 }],
    },
    select: { legacySourceId: true },
  });
  const khoa = thieu.map((p) => p.legacySourceId!).filter(Boolean);
  const map = new Map<string, Record<string, unknown>>();
  if (khoa.length === 0) return map;

  for (const bang of [prisma.case, prisma.incident] as const) {
    const rows = await (bang as { findMany: (a: unknown) => Promise<unknown[]> }).findMany({
      where: { legacySourceId: { in: khoa } },
      select: { legacySourceId: true, legacyRaw: true },
    });
    for (const r of rows as { legacySourceId: string | null; legacyRaw: unknown }[]) {
      if (r.legacySourceId && r.legacyRaw && !map.has(r.legacySourceId)) {
        map.set(r.legacySourceId, r.legacyRaw as Record<string, unknown>);
      }
    }
  }
  return map;
}
export async function donSoKhong(prisma: PrismaClient, dry: boolean): Promise<KetQua> {
  const kq: KetQua = { quet: 0, hoSoSua: 0, oDon: {}, oGiuVicoDonVi: {}, boQuaVieDaSuaTay: 0, boQuaViKhongCoBanGoc: 0 };
  const daSuaTay = await hoSoDaSuaTay(prisma);
  const rawAnhEm = await banGocTuAnhEm(prisma);
  console.log(`Bỏ qua ${daSuaTay.size} hồ sơ cán bộ đã từng sửa chính hai ô số này.`);
  for (const { col } of CAP_COT_KHOA) {
    kq.oDon[col] = 0;
    kq.oGiuVicoDonVi[col] = 0;
  }

  // KHÔNG dùng con trỏ: điều kiện lọc chính là thứ vòng lặp đang thay đổi. Bản ghi vừa dọn
  // thôi khớp `where`, nên vị trí con trỏ trôi và một số hàng bị nhảy qua — lần chạy đầu trên
  // máy thật bỏ sót đúng 60 ô vì lẽ đó.
  //
  // Lấy lại từ đầu mỗi vòng là đúng: hàng đã xử lý tự rơi khỏi tập kết quả, nên vòng lặp vẫn
  // tiến và dừng khi không còn hàng nào khớp.
  let choBoQua = new Set<string>();
  for (;;) {
    const rows = await prisma.petition.findMany({
      where: { OR: [{ soTienBiThietHai: 0 }, { soLuongBiHai: 0 }] },
      select: {
        id: true,
        legacyRaw: true,
        legacySourceId: true,
        soTienBiThietHai: true,
        soLuongBiHai: true,
      },
      orderBy: { id: "asc" },
      take: BATCH,
    });
    // Hàng còn khớp nhưng đã quyết định BỎ QUA thì không bao giờ rơi khỏi tập kết quả — không
    // nhận ra điều đó là vòng lặp chạy mãi.
    const canXuLy = rows.filter((r) => !choBoQua.has(r.id));
    if (canXuLy.length === 0) break;

    for (const row of canXuLy) {
      kq.quet++;
      if (daSuaTay.has(row.id)) {
        kq.boQuaVieDaSuaTay++;
        choBoQua.add(row.id);
        continue;
      }
      const goc = ((row.legacyRaw ?? (row.legacySourceId ? rawAnhEm.get(row.legacySourceId) : null)) ??
        null) as Record<string, unknown> | null;
      // Không có bản gốc thì không có căn cứ để dọn — bỏ qua, đếm riêng, nói ra.
      if (!goc) {
        kq.boQuaViKhongCoBanGoc++;
        choBoQua.add(row.id);
        continue;
      }

      const data: Record<string, null> = {};
      for (const { col, field } of CAP_COT_KHOA) {
        const giaTriCot = (row as unknown as Record<string, unknown>)[col];
        if (giaTriCot === null || Number(giaTriCot) !== 0) continue;
        if (laSoKhongDoChuyenNham(giaTriCot, goc[field])) {
          data[col] = null;
          kq.oDon[col]++;
        } else {
          kq.oGiuVicoDonVi[col]++;
        }
      }

      if (Object.keys(data).length === 0) {
        choBoQua.add(row.id);
        continue;
      }
      kq.hoSoSua++;
      if (dry) choBoQua.add(row.id);
      else await prisma.petition.update({ where: { id: row.id }, data });
    }

    if (kq.quet % 5000 < BATCH) {
      console.log(`  quét ${kq.quet}, hồ sơ sửa ${kq.hoSoSua}${dry ? " (THỬ)" : ""}`);
    }
  }
  return kq;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  if (!process.env['DATABASE_URL']) {
    console.error('Thiếu DATABASE_URL. Chạy: set -a && source .env && set +a');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    console.log(dry ? '── CHẠY THỬ, không ghi gì ──' : '── CHẠY THẬT ──');
    const kq = await donSoKhong(prisma, dry);
    console.log('');
    console.log(`Quét:            ${kq.quet} hồ sơ có ô số bằng 0`);
    console.log(`Hồ sơ sẽ sửa:    ${kq.hoSoSua}`);
    console.log(`Bỏ qua (đã sửa tay): ${kq.boQuaVieDaSuaTay}`);
    console.log(`Bỏ qua (không có bản gốc): ${kq.boQuaViKhongCoBanGoc}`);
    for (const { col } of CAP_COT_KHOA) {
      console.log(`  ${col}: dọn ${kq.oDon[col]}, giữ ${kq.oGiuVicoDonVi[col]} (bản gốc ghi số thật)`);
    }
    if (dry) console.log('\nChạy lại KHÔNG kèm --dry để ghi thật.');
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
