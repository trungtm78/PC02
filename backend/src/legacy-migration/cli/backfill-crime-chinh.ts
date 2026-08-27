/**
 * Nối TỘI DANH CHÍNH của hồ sơ di trú sang khoá ngoại bảng master `Crime`.
 *
 * Vì sao: hệ cũ ghi tội danh bằng SỐ (`toi_danh_chinh_blhs2015` / `toi_danh_chinh` =
 * `Crime.legacyValue`), nên nếu không nối thì tội danh không hiện trong ô chọn và không
 * lọc/thống kê được.
 *
 * Chạy cho CẢ Vụ án lẫn Vụ việc. Vụ việc có cột `crimeChinhId` từ 27/08/2026; trước đó 1.114
 * hồ sơ mang mã tội danh cũ mà không có chỗ ở, và tra cứu theo tội danh sót hẳn một giai đoạn
 * tố tụng.
 *
 * AN TOÀN: chỉ hồ sơ CHƯA có `crimeChinhId`, câu ghi kèm điều kiện ấy nên cán bộ chọn tội danh
 * xen giữa lúc đọc và lúc ghi thì bỏ qua. Chạy hai lần cho kết quả như một. Mặc định `--dry`.
 *
 * Dùng:  set -a && source .env && set +a
 *        node dist/src/legacy-migration/cli/backfill-crime-chinh.js [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { chonToiDanh, chuanTenToi, type BangTraToiDanh } from './chon-toi-danh';
import { banGocTuAnhEm, type KhoBang } from './ban-goc-anh-em';
import type { Entity } from './parity-classify';

export { chuanTenToi };

interface ThucThe {
  ten: string;
  khoa: Entity;
  /** Cột chữ giữ tên tội danh, dùng làm đường lùi khi hệ cũ không ghi số. */
  cotTen?: string;
}

const BANG_THUC_THE: ThucThe[] = [
  { ten: 'Vụ án', khoa: 'case', cotTen: 'crime' },
  // Vụ việc không có cột chữ nào giữ TÊN tội danh (`toiDanhBanDau` là nhận định ban đầu của
  // hệ cũ, không phải tên điều luật), nên chỉ nối qua số — thà bỏ sót còn hơn gán nhầm tội.
  { ten: 'Vụ việc', khoa: 'incident' },
];

export interface KetQuaMotThucThe {
  chuaCo: number;
  quaSo: number;
  quaTen: number;
  khong: number;
  boQuaViSuaXen: number;
}

async function chayMot(
  prisma: PrismaClient,
  tt: ThucThe,
  bang: BangTraToiDanh,
  apply: boolean,
): Promise<KetQuaMotThucThe> {
  const kq: KetQuaMotThucThe = { chuaCo: 0, quaSo: 0, quaTen: 0, khong: 0, boQuaViSuaXen: 0 };
  const delegate = (prisma as unknown as Record<string, any>)[tt.khoa];

  // Hồ sơ là VỎ LIÊN KẾT: bản thô nằm ở thực thể anh em cùng khoá nguồn. Bỏ nhóm này thì đúng
  // những hồ sơ khó nhất không được nối.
  const rawAnhEm = await banGocTuAnhEm(prisma as unknown as KhoBang, tt.khoa, {
    crimeChinhId: null,
  });

  const select: Record<string, boolean> = { id: true, legacyRaw: true, legacySourceId: true };
  if (tt.cotTen) select[tt.cotTen] = true;

  const rows: Record<string, unknown>[] = await delegate.findMany({
    where: { legacySourceId: { not: null }, crimeChinhId: null, deletedAt: null },
    select,
  });
  kq.chuaCo = rows.length;

  for (const r of rows) {
    const goc =
      (r.legacyRaw as Record<string, unknown> | null) ??
      (r.legacySourceId ? rawAnhEm.get(r.legacySourceId as string) : null);
    const chon = chonToiDanh(goc, tt.cotTen ? (r[tt.cotTen] as string | null) : null, bang);
    if (!chon.crimeId) {
      kq.khong++;
      continue;
    }
    if (apply) {
      // Chỉ ăn nếu hồ sơ VẪN chưa có tội danh — cán bộ chọn xen giữa thì bỏ qua.
      const ghi = await delegate.updateMany({
        where: { id: r.id, crimeChinhId: null },
        data: { crimeChinhId: chon.crimeId },
      });
      if (ghi.count === 0) {
        kq.boQuaViSuaXen++;
        continue;
      }
    }
    if (chon.cach === 'so') kq.quaSo++;
    else kq.quaTen++;
  }
  return kq;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });

  try {
    const crimes = await prisma.crime.findMany({
      select: { id: true, name: true, legacyValue: true },
    });
    const theoSo = new Map<number, string>();
    const theoTen = new Map<string, string>();
    for (const c of crimes) {
      if (c.legacyValue != null) theoSo.set(c.legacyValue, c.id);
      theoTen.set(chuanTenToi(c.name), c.id);
    }
    const bang: BangTraToiDanh = { theoSo, theoTen };

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    for (const tt of BANG_THUC_THE) {
      const kq = await chayMot(prisma, tt, bang, apply);
      console.log(`${tt.ten} chưa có tội danh FK : ${kq.chuaCo}`);
      console.log(`  → nối qua số (legacyValue): ${kq.quaSo}`);
      console.log(`  → nối qua khớp tên        : ${kq.quaTen}`);
      console.log(`  → không resolve được      : ${kq.khong}`);
      if (kq.boQuaViSuaXen) console.log(`  → bỏ qua vì cán bộ sửa xen: ${kq.boQuaViSuaXen}`);
      console.log('');
    }
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
