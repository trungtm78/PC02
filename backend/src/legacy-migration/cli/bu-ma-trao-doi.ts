/**
 * bu-ma-trao-doi.ts — bù MÃ HỒ SƠ (`recordCode`) cho Trao đổi chuyên án di trú đang rỗng mã.
 *
 * Đo prod 17/09/2026: 73/76 bản `exchanges` có `recordCode` rỗng; mã thật `năm-stt` nằm trong
 * `legacyRaw` (cùng quy tắc đã bù cho vụ án / vụ việc / đơn thư). Bảng hiện mã ấy nhưng thẻ Mã hồ sơ
 * tìm trên `recordCode` — gõ đúng mã đang thấy vẫn không ra (Codex rà 5de2b391).
 *
 * • Chỉ đụng mã ĐANG RỖNG — không bao giờ đè mã đã có. `recordCode` không unique nên không cần hậu tố.
 * • Chỉ năm 4 chữ số + stt toàn số; thiếu dữ kiện thì để rỗng và đếm ra.
 * • MẶC ĐỊNH CHỈ ĐỌC + in mẫu; `--apply` ghi trong một giao dịch, ghi lệch số đếm thì huỷ.
 *
 * Dùng: set -a && source .env && set +a
 *       node dist/src/legacy-migration/cli/bu-ma-trao-doi.js [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DIEU_KIEN =
  `coalesce("recordCode", '') = '' AND "deletedAt" IS NULL ` +
  `AND coalesce("legacyRaw"->>'nam', '') ~ '^[0-9]{4}$' ` +
  `AND coalesce("legacyRaw"->>'stt', '') ~ '^[0-9]+$'`;

/** Đếm: rỗng mã (mọi bản đang dùng) · trong số ấy bù được. */
export function cauDemMa(): string {
  return (
    `SELECT count(*) FILTER (WHERE coalesce("recordCode", '') = '')::int AS "thieu", ` +
    `count(*) FILTER (WHERE ${DIEU_KIEN})::int AS "buDuoc" ` +
    `FROM "exchanges" WHERE "deletedAt" IS NULL`
  );
}

export function cauMauMa(soDong: number): string {
  return (
    `SELECT "legacySourceId" AS "khoa", ("legacyRaw"->>'nam') || '-' || ("legacyRaw"->>'stt') AS "ma" ` +
    `FROM "exchanges" WHERE ${DIEU_KIEN} ORDER BY "legacySourceId" LIMIT ${Math.max(1, Math.trunc(soDong))}`
  );
}

/** Ghi: không động `updatedAt` — sửa di trú, không phải cán bộ sửa (giữ thứ tự danh sách). */
export function cauBuMa(): string {
  return (
    `UPDATE "exchanges" SET "recordCode" = ("legacyRaw"->>'nam') || '-' || ("legacyRaw"->>'stt') ` +
    `WHERE ${DIEU_KIEN}`
  );
}

export interface PrismaBuMa {
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
  $transaction<T>(fn: (tx: PrismaBuMa) => Promise<T>): Promise<T>;
}

export async function buMaTraoDoi(
  prisma: PrismaBuMa,
  apply: boolean,
  inRa: (dong: string) => void = console.log,
): Promise<{ thieu: number; buDuoc: number; daBu: number }> {
  inRa(
    `\n=== Bù mã Trao đổi chuyên án — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`,
  );
  const [dem] =
    await prisma.$queryRawUnsafe<Array<{ thieu: number; buDuoc: number }>>(
      cauDemMa(),
    );
  const thieu = dem?.thieu ?? 0;
  const buDuoc = dem?.buDuoc ?? 0;
  inRa(
    `exchanges: rỗng mã ${thieu} · bù được ${buDuoc} · thiếu dữ kiện ${thieu - buDuoc}`,
  );
  if (buDuoc > 0) {
    const mau = await prisma.$queryRawUnsafe<
      Array<{ khoa: string | null; ma: string }>
    >(cauMauMa(3));
    for (const m of mau) inRa(`   ${m.khoa} → ${m.ma}`);
  }
  if (!apply || buDuoc === 0) {
    if (!apply) inRa('\nCHỈ ĐỌC — không ghi gì. Chạy lại với --apply để ghi.');
    return { thieu, buDuoc, daBu: 0 };
  }
  const daBu = await prisma.$transaction(async (tx) => {
    const n = await tx.$executeRawUnsafe(cauBuMa());
    if (n !== buDuoc)
      throw new Error(
        `exchanges: đếm ${buDuoc} mà ghi ${n} — huỷ, không ghi gì`,
      );
    return n;
  });
  inRa(`exchanges: đã bù ${daBu}`);
  return { thieu, buDuoc, daBu };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    await buMaTraoDoi(
      prisma as unknown as PrismaBuMa,
      process.argv.includes('--apply'),
    );
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
