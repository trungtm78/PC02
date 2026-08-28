/**
 * Nạp chữ viết tắt cán bộ từ hệ cũ (`thanh_vien.ten_ngan`) vào cột `users.shortName`.
 *
 * ── Vì sao ──
 *
 * `${ten_ngan}` đứng ở dòng "Lưu:" cuối MỌI chứng từ. Hệ cũ không suy ra chữ ấy — mỗi cán bộ
 * tự đặt một chuỗi, và mã in đổ thẳng chuỗi đó. Hệ mới đang suy ra "chữ đệm cuối + tên gọi",
 * quy tắc đúng với phần lớn tên người nhưng sai hẳn với `Bùi Thanh Trà → Trà`, `Đội 5 → Đ5`,
 * `Tổ Truy Nã → TRUYNA`.
 *
 * Đo 28/08/2026 trên dữ liệu sống: 238 cán bộ, khớp 11 · sai 210 · để rỗng 16 · không có cột 1.
 * Quy theo số hồ sơ: **16.713/55.207 (30,3%)** bản in ghi sai dòng "Lưu:".
 *
 * ── Ghép cán bộ hai hệ bằng gì ──
 *
 * Bằng HỌ TÊN đầy đủ. Hệ mới lưu tách đôi theo quy ước tiếng Anh nên ghép lại là
 * `lastName || ' ' || firstName`, đúng chuỗi `ten` của hệ cũ. Tên trùng nhau thì BỎ QUA cả cụm
 * và báo ra, chứ không gán bừa — gán nhầm là in tên người khác lên văn bản đã ký.
 *
 * ── Dùng ──
 *
 *   LEGACY_MONGO_URI="mongodb://…" npx ts-node src/legacy-migration/cli/nap-ten-ngan-can-bo.ts
 *   LEGACY_MONGO_URI="mongodb://…" npx ts-node src/legacy-migration/cli/nap-ten-ngan-can-bo.ts --apply
 *
 * Mặc định là chạy thử, `--apply` mới ghi. Idempotent: chạy lại chỉ ghi những chỗ còn khác.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface CanBoHeCu {
  /** `id` số của hệ cũ — chính là `nguoi_them` trên mỗi hồ sơ. */
  id?: number;
  ten: string;
  ten_ngan?: string | null;
}

export interface CanBoHeMoi {
  id: string;
  firstName: string | null;
  lastName: string | null;
  shortName: string | null;
}

export interface KeHoachNap {
  ghi: Array<{ id: string; hoTen: string; tu: string | null; sang: string }>;
  boQuaTrungTen: string[];
  khongTimThay: string[];
  daDung: number;
}

/** Họ tên đầy đủ của một tài khoản hệ mới, ghép đúng thứ tự hệ cũ lưu. */
export function hoTenDayDu(u: CanBoHeMoi): string {
  return [u.lastName, u.firstName].filter(Boolean).join(' ').trim();
}

/**
 * Dựng kế hoạch nạp. Hàm THUẦN — kiểm chứng được mà không cần CSDL nào.
 *
 * Chỉ nạp cán bộ hệ cũ CÓ cột `ten_ngan` (kể cả chuỗi rỗng: rỗng là một lựa chọn có chủ ý, hệ
 * cũ in ra trống). Không có cột thì để `shortName` là NULL, và bộ in rơi về họ tên đầy đủ —
 * đúng nhánh `?? $nguoi_nhan` của hệ cũ.
 *
 * `theoDauVet` ánh xạ `id cán bộ hệ cũ → id tài khoản hệ mới`, dựng từ chính hồ sơ đã di trú.
 * Nó đứng TRƯỚC phép ghép theo họ tên vì nó là bằng chứng trực tiếp: bộ di trú đã gắn hồ sơ ấy
 * cho đúng tài khoản. Không có nó thì 11 cán bộ trùng họ tên bị bỏ qua, ứng với 18.617 hồ sơ
 * (33,7%) — lớn hơn cả vấn đề đang sửa (đo 28/08/2026).
 */
export function lenKeHoach(
  heCu: CanBoHeCu[],
  heMoi: CanBoHeMoi[],
  theoDauVet?: Map<number, string>,
): KeHoachNap {
  const theoTen = new Map<string, CanBoHeMoi[]>();
  const theoId = new Map<string, CanBoHeMoi>();
  for (const u of heMoi) {
    theoId.set(u.id, u);
    const ten = hoTenDayDu(u);
    if (!ten) continue;
    const cu = theoTen.get(ten);
    if (cu) cu.push(u);
    else theoTen.set(ten, [u]);
  }

  const kh: KeHoachNap = { ghi: [], boQuaTrungTen: [], khongTimThay: [], daDung: 0 };
  for (const c of heCu) {
    if (c.ten_ngan === undefined || c.ten_ngan === null) continue;
    const ten = String(c.ten ?? '').trim();
    if (!ten) continue;

    let u: CanBoHeMoi | undefined;
    const idMoi = c.id === undefined ? undefined : theoDauVet?.get(Number(c.id));
    if (idMoi !== undefined) {
      u = theoId.get(idMoi);
      if (!u) {
        // Dấu vết trỏ tới tài khoản không còn tồn tại — báo ra chứ không lặng lẽ lùi về họ tên,
        // vì lùi ở đây là gán cho một người KHÁC.
        kh.khongTimThay.push(ten);
        continue;
      }
    } else {
      const ung = theoTen.get(ten);
      if (!ung || !ung.length) {
        kh.khongTimThay.push(ten);
        continue;
      }
      if (ung.length > 1) {
        kh.boQuaTrungTen.push(ten);
        continue;
      }
      u = ung[0];
    }
    const moi = String(c.ten_ngan);
    if (u.shortName === moi) {
      kh.daDung += 1;
      continue;
    }
    kh.ghi.push({ id: u.id, hoTen: ten, tu: u.shortName, sang: moi });
  }
  return kh;
}

async function main(): Promise<void> {
  const mongoUri = process.env['LEGACY_MONGO_URI'];
  if (!mongoUri) {
    console.error('LỖI: cần `LEGACY_MONGO_URI`. KHÔNG viết cứng chuỗi kết nối vào kho mã.');
    process.exit(1);
  }
  const apDung = process.argv.includes('--apply');

  const { MongoClient } = await import('mongodb');
  const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 30_000 });
  await mongo.connect();
  let heCu: CanBoHeCu[];
  try {
    heCu = (await mongo
      .db()
      .collection('thanh_vien')
      .find({}, { projection: { ten: 1, ten_ngan: 1, _id: 0 } })
      .toArray()) as unknown as CanBoHeCu[];
  } finally {
    await mongo.close();
  }

  // Prisma 7 bắt buộc khai bộ nối; `new PrismaClient()` trần ném ngay lúc dựng.
  // Prisma 7 bắt buộc khai bộ nối; `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const heMoi = (await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, shortName: true },
    })) as CanBoHeMoi[];

    /**
     * Bảng dấu vết: `nguoi_them` của hệ cũ → tài khoản hệ mới, đọc từ chính hồ sơ đã di trú.
     *
     * Chỉ nhận khi MỘT `nguoi_them` ứng với ĐÚNG MỘT tài khoản. Ứng với nhiều tài khoản nghĩa là
     * bộ di trú đã gắn không nhất quán — lúc ấy dấu vết không còn là bằng chứng, lùi về họ tên.
     */
    const dauVet = await prisma.$queryRawUnsafe<Array<{ nguoi_them: string; ids: string[] }>>(
      `select "legacyRaw"->>'nguoi_them' as nguoi_them, array_agg(distinct "enteredById") as ids
         from petitions
        where "enteredById" is not null and "legacyRaw"->>'nguoi_them' is not null
        group by 1`,
    );
    const theoDauVet = new Map<number, string>();
    for (const d of dauVet) {
      if (d.ids.length === 1 && /^\d+$/.test(d.nguoi_them)) {
        theoDauVet.set(Number(d.nguoi_them), d.ids[0]);
      }
    }

    const kh = lenKeHoach(heCu, heMoi, theoDauVet);
    const soRong = kh.ghi.filter((g) => g.sang === '').length;
    console.log(
      `Hệ cũ ${heCu.length} cán bộ · hệ mới ${heMoi.length} tài khoản · dấu vết ${theoDauVet.size}\n` +
        `  cần ghi        : ${kh.ghi.length}  (chuỗi có chữ ${kh.ghi.length - soRong} · để trống ${soRong})\n` +
        `  đã đúng sẵn    : ${kh.daDung}\n` +
        `  bỏ qua trùng tên: ${kh.boQuaTrungTen.length}${kh.boQuaTrungTen.length ? ` — ${kh.boQuaTrungTen.join(', ')}` : ''}\n` +
        `  không có tài khoản: ${kh.khongTimThay.length}${kh.khongTimThay.length ? ` — ${kh.khongTimThay.slice(0, 10).join(', ')}` : ''}`,
    );
    for (const g of kh.ghi.slice(0, 15)) {
      console.log(`  ${g.hoTen}: ${g.tu ?? '(chưa có)'} → ${JSON.stringify(g.sang)}`);
    }
    if (kh.ghi.length > 15) console.log(`  … còn ${kh.ghi.length - 15} tài khoản nữa`);

    if (!apDung) {
      console.log('\nChạy thử — chưa ghi gì. Thêm `--apply` để ghi thật.');
      return;
    }
    for (const g of kh.ghi) {
      await prisma.user.update({ where: { id: g.id }, data: { shortName: g.sang } });
    }
    console.log(`\n✓ Đã ghi ${kh.ghi.length} tài khoản.`);
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
