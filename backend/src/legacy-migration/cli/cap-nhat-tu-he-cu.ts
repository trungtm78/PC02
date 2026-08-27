/**
 * Cập nhật hồ sơ mới của hệ cũ vào hệ mới — đọc THẲNG MongoDB hệ cũ, không cần dump.
 *
 * Bộ di trú gốc đi từ tệp dump BSON: xuất dump → `stage.ts` → `import.ts`. Cách ấy đúng cho
 * lần chuyển đầu, nhưng để CẬP NHẬT hằng ngày thì phải xin dump mới mỗi lần. Tệp này nối
 * thẳng vào Mongo hệ cũ, lấy đúng phần đã đổi, và dùng LẠI nguyên đường nạp cũ — cùng bảng
 * chờ, cùng bảng tra cứu, cùng `LegacyMigrationService.commit`.
 *
 * CHỈ ĐỌC hệ cũ. Không một lệnh ghi nào chạm sang đó.
 *
 * Chỉ đụng hai nhóm hồ sơ (xem `chon-ho-so-can-cap-nhat.ts`): hệ mới chưa có, và hệ cũ đã sửa
 * sau lần di trú. Chạy lại toàn bộ là ghi đè dữ liệu hệ cũ lên thứ cán bộ vừa sửa ở hệ mới.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   LEGACY_MONGO_URI="mongodb://..." node dist/src/legacy-migration/cli/cap-nhat-tu-he-cu.js --dry
 *   LEGACY_MONGO_URI="mongodb://..." node dist/src/legacy-migration/cli/cap-nhat-tu-he-cu.js
 */
import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LegacyMigrationService } from '../legacy-migration.service';
import type { LegacyRecord } from '../legacy-mapper';
import { loadLookups, attachOwnership, attachInferredClass } from './import';
import { chonHoSoCanCapNhat, type TaiLieuHeCu } from './chon-ho-so-can-cap-nhat';
import { buMaHoSo } from './backfill-ma-ho-so';

/** Bảng hệ cũ giữ hồ sơ chính. Các bảng tra cứu khác không đổi hằng ngày nên không đụng. */
const BANG_HO_SO = 'ho_so_doi_1';

/** Mọi bảng hệ mới có thể nhận một hồ sơ hệ cũ — tuỳ `phan_loai_nguon_tin_ban_dau`. */
const BANG_DICH = [
  'petition',
  'incident',
  'case',
  'guidanceRecord',
  'exchange',
  'proposal',
  'lawyer',
] as const;

/** Khoá di trú → `_update_time` của bản đang nằm trong hệ mới. */
export async function mocDaCoTrongHeMoi(prisma: PrismaClient): Promise<Map<string, number>> {
  const moc = new Map<string, number>();
  const kho = prisma as unknown as Record<
    string,
    { findMany: (a: unknown) => Promise<{ legacySourceId: string | null; legacyRaw: unknown }[]> }
  >;
  for (const bang of BANG_DICH) {
    // Bảng chưa có trong lược đồ thì bỏ qua — lược đồ đổi theo thời gian, và một bảng thiếu
    // không nên chặn cả lần cập nhật. Nhưng MỌI lỗi khác thì NÉM: nuốt một lỗi đọc thật (mất
    // kết nối, thiếu quyền, lệch lược đồ) là coi cả bảng ấy rỗng, và mọi hồ sơ chỉ nằm ở đó
    // bị coi là chưa có rồi nạp đè lên bản cán bộ đang dùng.
    const model = kho[bang];
    if (!model || typeof model.findMany !== 'function') continue;
    const rows = await model.findMany({
      where: { legacySourceId: { not: null } },
      select: { legacySourceId: true, legacyRaw: true },
    });
    for (const r of rows) {
      if (!r.legacySourceId) continue;
      const raw = (r.legacyRaw ?? {}) as Record<string, unknown>;
      const u = Number(raw['_update_time'] ?? 0);
      // Ghi nhận khoá TRƯỚC, rồi mới so mốc. Chỉ ghi khi `u` lớn hơn thì bản ghi không có
      // `_update_time` (đo trên máy thật: 164 hồ sơ) không bao giờ vào bảng — hệ thống coi
      // chúng là CHƯA CÓ và nạp đè lại ở mọi lần cập nhật sau.
      //
      // Một hồ sơ hệ cũ có thể sinh ra nhiều thực thể (vụ việc rồi khởi tố thành vụ án — 169
      // khoá dùng ở hai bảng). Giữ mốc MỚI NHẤT: giữ mốc cũ hơn thì lần sau nạp lại thừa,
      // mà nạp lại là ghi đè.
      const daCo = moc.get(r.legacySourceId);
      if (daCo === undefined || u > daCo) moc.set(r.legacySourceId, u);
    }
  }
  return moc;
}

/**
 * Kích thước lô phải là số nguyên dương.
 *
 * `--batch 0` làm vòng lặp đứng im mãi mãi, `--batch -1` chạy lùi — cả hai đều treo lần cập
 * nhật SAU KHI đã mở kết nối và đã ghi được một phần, tức dừng giữa chừng ở trạng thái khó
 * đoán. Chặn ngay từ đầu rẻ hơn nhiều.
 */
export function kichThuocLo(v: string | undefined): number {
  if (v === undefined) return 100;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Kích thước lô phải là số nguyên dương, nhận được: ${v}`);
  }
  return n;
}

interface TuyChon {
  dry: boolean;
  batchSize: number;
  actorId: string;
  gioiHan?: number;
}

export interface KetQuaCapNhat {
  heCu: number;
  chuaCo: number;
  daSua: number;
  khongDoi: number;
  daNap: number;
  boQua: number;
  loi: number;
}

async function main(): Promise<void> {
  const arg = (t: string): string | undefined => {
    const i = process.argv.indexOf(`--${t}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const opts: TuyChon = {
    dry: process.argv.includes('--dry'),
    batchSize: kichThuocLo(arg('batch')),
    actorId: arg('actor') ?? '',
    gioiHan: arg('gioi-han') ? Number(arg('gioi-han')) : undefined,
  };

  const mongoUri = process.env['LEGACY_MONGO_URI'];
  if (!mongoUri) {
    console.error('LỖI: cần `LEGACY_MONGO_URI`. KHÔNG viết cứng chuỗi kết nối vào kho mã.');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 30_000 });

  try {
    await mongo.connect();
    const db = mongo.db(process.env['LEGACY_MONGO_DB'] ?? 'pc02');

    // Đọc gọn: chỉ ba trường đủ để QUYẾT ĐỊNH. Kéo cả tài liệu cho 55.000 hồ sơ chỉ để so
    // một con số là tải về vài trăm MB không dùng đến.
    const nhe = (await db
      .collection(BANG_HO_SO)
      .find({}, { projection: { id: 1, da_xoa: 1, _update_time: 1 } })
      .toArray()) as unknown as TaiLieuHeCu[];

    const moc = await mocDaCoTrongHeMoi(prisma);
    const chon = chonHoSoCanCapNhat(nhe, moc, BANG_HO_SO);

    const kq: KetQuaCapNhat = {
      heCu: nhe.length,
      chuaCo: chon.chuaCo,
      daSua: chon.daSua,
      khongDoi: chon.khongDoi,
      daNap: 0,
      boQua: 0,
      loi: 0,
    };
    console.log(
      `[cap-nhat] hệ cũ ${kq.heCu} hồ sơ | chưa có ${kq.chuaCo} | đã sửa ${kq.daSua} | ` +
        `không đổi ${kq.khongDoi} | hệ cũ đã xoá ${chon.boQuaVìĐãXoá} | thiếu id ${chon.boQuaVìThiếuId}`,
    );

    let can = chon.canCapNhat;
    if (opts.gioiHan) can = can.slice(0, opts.gioiHan);
    if (can.length === 0) {
      console.log('[cap-nhat] không có gì phải cập nhật.');
      return;
    }
    if (opts.dry) {
      console.log(`[cap-nhat] THỬ — sẽ nạp ${can.length} hồ sơ, không ghi gì.`);
      console.log(
        '  mười hồ sơ đầu: ' +
          can
            .slice(0, 10)
            .map((c) => `${c.sourceId}(${c.lyDo})`)
            .join(' '),
      );
      return;
    }

    let actorId = opts.actorId;
    if (!actorId) {
      const admin = await prisma.user.findFirst({
        where: { role: { name: 'ADMIN' } },
        select: { id: true },
      });
      if (!admin) throw new Error('Không tìm thấy tài khoản ADMIN để ghi nhận người chạy di trú.');
      actorId = admin.id;
    }
    const lk = await loadLookups(prisma);
    const service = new LegacyMigrationService(prisma as never, {
      log: async () => undefined,
    } as never);

    for (let i = 0; i < can.length; i += opts.batchSize) {
      const lo = can.slice(i, i + opts.batchSize);
      const ids = lo.map((c) => Number(c.sourceId)).filter((n) => Number.isFinite(n));
      const day = await db
        .collection(BANG_HO_SO)
        .find({ id: { $in: ids } })
        .toArray();

      // Giữ NGUYÊN bản thô vào bảng chờ trước khi biến đổi — hệt đường dump cũ, nên lúc nào
      // cũng tra ngược được hệ mới đang dựng từ tài liệu nào.
      for (const d of day) {
        const raw = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
        await prisma.legacyStaging.upsert({
          where: { sourceFile_sourceId: { sourceFile: BANG_HO_SO, sourceId: String(d['id']) } },
          create: {
            runId: 'cap-nhat-tu-he-cu',
            sourceFile: BANG_HO_SO,
            sourceId: String(d['id']),
            rowHash: '',
            raw: raw as never,
          },
          update: { raw: raw as never, runId: 'cap-nhat-tu-he-cu' },
        });
      }

      const records: LegacyRecord[] = day.map((d) =>
        attachOwnership(
          attachInferredClass({
            ...(JSON.parse(JSON.stringify(d)) as LegacyRecord),
            __sourceCollection: BANG_HO_SO,
          }),
          lk,
        ),
      );
      const res = await service.commit(records, actorId);
      kq.daNap += Object.values(res.created).reduce((a, b) => a + b, 0);
      kq.boQua += res.skipped;
      kq.loi += res.errors.length;
      for (const e of res.errors.slice(0, 3)) {
        console.log('  lỗi:', e.legacyId, e.message.slice(0, 120));
      }
      console.log(`  ...đã xử lý ${Math.min(i + opts.batchSize, can.length)}/${can.length}`);
    }

    console.log(`[cap-nhat] nạp ${kq.daNap} bản ghi | bỏ qua ${kq.boQua} | lỗi ${kq.loi}`);

    // Đường nhập đặt mã TẠM (`DT-LEGACY-…`) lúc tạo và chờ bước này cấp mã thật, rồi nâng bộ
    // đếm số cho khớp. Bỏ bước này thì hồ sơ vừa nạp mang mã vô nghĩa — cán bộ tra theo mã hệ
    // cũ không thấy — và bộ đếm tụt lại phía sau, nên hồ sơ tạo mới sau đó TRÙNG mã với hồ sơ
    // vừa nạp. Cả hai đã xảy ra thật ngày 28/08/2026 với 83 đơn thư.
    await buMaHoSo(prisma, true);

    console.log('[cap-nhat] XONG.');
  } finally {
    await mongo.close();
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
