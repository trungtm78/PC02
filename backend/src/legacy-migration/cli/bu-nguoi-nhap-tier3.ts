/**
 * bu-nguoi-nhap-tier3.ts — bù NGƯỜI NHẬP (`createdById`) cho hồ sơ tier-3 đã di trú.
 *
 * PHÁT HIỆN 17/09/2026 khi chuyển tìm kiếm Hướng dẫn đơn xuống máy chủ: ba builder tier-3
 * (`buildGuidance`, `buildExchange`, `buildProposal`) không gắn người nhập, dù bộ nạp đã tra sẵn
 * `__createdById` từ `nguoi_them`. Đo prod (chỉ đọc): 650/650 bản NULL — hướng dẫn 541, trao đổi 76,
 * kiến nghị 33 — và 650/650 có `legacyRaw.__createdById` khớp một người dùng.
 *
 * Hệ quả: phạm vi dữ liệu của ba màn lọc `createdById IN userIds` (kiến nghị: khi không gắn vụ án),
 * mà OFFICER luôn có userIds (ít nhất chính mình) ⇒ 247 cán bộ OFFICER thấy 0 bản ghi.
 *
 * • Chỉ đụng ô ĐANG TRỐNG — không bao giờ đè người nhập đã có.
 * • Chỉ gán id CÓ trong `users` (khoá ngoại); không khớp thì để trống và đếm ra.
 * • Chạy lại cho kết quả y hệt (lần hai: 0 dòng).
 * • MẶC ĐỊNH CHỈ ĐỌC, in mẫu để người đọc kiểm trước; `--apply` mới ghi, trong một giao dịch.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/bu-nguoi-nhap-tier3.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Bảng tier-3 mà phạm vi dữ liệu lọc theo `createdById`. Tên bảng CSDL (có `@@map`). */
export const BANG_TIER3 = [
  'guidance_records',
  'exchanges',
  'proposals',
] as const;
export type BangTier3 = (typeof BANG_TIER3)[number];

const NGUOI_TRONG_BAN_THO = `"legacyRaw"->>'__createdById'`;

/** Đếm: đang trống người nhập · trong số ấy bù được (id có trong users). */
export function cauDem(bang: BangTier3): string {
  return (
    `SELECT count(*)::int AS "thieu", ` +
    `count(u.id)::int AS "buDuoc" ` +
    `FROM "${bang}" b LEFT JOIN users u ON u.id = b.${NGUOI_TRONG_BAN_THO} ` +
    `WHERE b."createdById" IS NULL AND b."deletedAt" IS NULL`
  );
}

/** Mẫu để đọc trước khi ghi: mã nguồn, người sẽ gán. */
export function cauMau(bang: BangTier3, soDong: number): string {
  return (
    `SELECT b."legacySourceId" AS "khoa", u.username AS "taiKhoan", ` +
    `concat_ws(' ', u."lastName", u."firstName") AS "hoTen" ` +
    `FROM "${bang}" b JOIN users u ON u.id = b.${NGUOI_TRONG_BAN_THO} ` +
    `WHERE b."createdById" IS NULL AND b."deletedAt" IS NULL ` +
    `ORDER BY b."legacySourceId" LIMIT ${Math.max(1, Math.trunc(soDong))}`
  );
}

/** Ghi: chỉ ô trống, chỉ id có trong users. Không động `updatedAt` — đây là sửa di trú, không phải cán bộ sửa. */
export function cauBu(bang: BangTier3): string {
  return (
    `UPDATE "${bang}" b SET "createdById" = u.id FROM users u ` +
    `WHERE u.id = b.${NGUOI_TRONG_BAN_THO} AND b."createdById" IS NULL ` +
    // CÙNG tập với câu đếm — lệch tập là số ghi khác số đếm và cả lượt bị huỷ oan.
    `AND b."deletedAt" IS NULL`
  );
}

export interface KetQuaBang {
  bang: BangTier3;
  thieu: number;
  buDuoc: number;
  daBu: number;
}

export interface PrismaBu {
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
  $transaction<T>(fn: (tx: PrismaBu) => Promise<T>): Promise<T>;
}

export async function buNguoiNhapTier3(
  prisma: PrismaBu,
  apply: boolean,
  inRa: (dong: string) => void = console.log,
): Promise<KetQuaBang[]> {
  inRa(
    `\n=== Bù người nhập tier-3 — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`,
  );
  const ketQua: KetQuaBang[] = [];
  for (const bang of BANG_TIER3) {
    const [dem] = await prisma.$queryRawUnsafe<
      Array<{ thieu: number; buDuoc: number }>
    >(cauDem(bang));
    const thieu = dem?.thieu ?? 0;
    const buDuoc = dem?.buDuoc ?? 0;
    inRa(
      `${bang}: trống ${thieu} · bù được ${buDuoc} · không khớp người dùng ${thieu - buDuoc}`,
    );
    if (buDuoc > 0) {
      const mau = await prisma.$queryRawUnsafe<
        Array<{
          khoa: string | null;
          taiKhoan: string | null;
          hoTen: string | null;
        }>
      >(cauMau(bang, 3));
      for (const m of mau) inRa(`   ${m.khoa} → ${m.taiKhoan} (${m.hoTen})`);
    }
    ketQua.push({ bang, thieu, buDuoc, daBu: 0 });
  }
  if (!apply) {
    inRa('\nCHỈ ĐỌC — không ghi gì. Chạy lại với --apply để ghi.');
    return ketQua;
  }
  await prisma.$transaction(async (tx) => {
    for (const k of ketQua) {
      if (k.buDuoc === 0) continue;
      k.daBu = await tx.$executeRawUnsafe(cauBu(k.bang));
      // Ghi khác số đã đếm nghĩa là dữ liệu đổi giữa chừng — huỷ cả giao dịch, không ghi nửa vời.
      if (k.daBu !== k.buDuoc) {
        throw new Error(
          `${k.bang}: đếm ${k.buDuoc} mà ghi ${k.daBu} — huỷ, không ghi gì`,
        );
      }
    }
  });
  for (const k of ketQua) inRa(`${k.bang}: đã bù ${k.daBu}`);
  return ketQua;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    await buNguoiNhapTier3(prisma as unknown as PrismaBu, apply);
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
