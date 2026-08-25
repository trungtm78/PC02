/**
 * stage-from-ejsonl.ts — nạp hồ sơ hệ cũ từ bản xuất `.ejsonl` vào bảng chờ
 * `legacy_staging`, NGUYÊN VĂN, không biến đổi gì.
 *
 * VÌ SAO CẦN: đường nhập sẵn có (`stage.ts`) chỉ đọc `.bson` do `mongodump` sinh ra.
 * Bản xuất gần nhất (02/08) lại là `.ejsonl` do `mongo-export.ts` sinh ra, và máy này
 * không có `mongodump` để tạo lại định dạng kia. Tệp này lấp đúng chỗ hở đó — và CHỈ
 * chỗ đó: mọi biến đổi dữ liệu vẫn do `import.ts` làm, không đụng tới.
 *
 * Khoá và băm dòng dùng ĐÚNG quy tắc của `stage.ts` (`v2-collection-prefixed`), nếu
 * không hồ sơ sẽ bị nhân đôi thay vì nhận ra là đã có.
 *
 * MẶC ĐỊNH CHỈ ĐỌC. Chỉ khi có `--apply` mới ghi.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/stage-from-ejsonl.ts \
 *         --file <duong-dan>.ejsonl [--refresh-changed] [--apply]
 *
 *   --refresh-changed  CẬP NHẬT hồ sơ đã có nhưng nội dung hệ cũ đã đổi
 *
 * Không có cờ này thì công cụ chỉ THÊM MỚI: hồ sơ cũ được cán bộ
 * SỬA ở hệ cũ sau lượt nạp trước thì vẫn "đã có" nên bị bỏ qua, và bản trong bảng chờ đứng
 * yên ở nội dung cũ — số lượng khớp mà nội dung sai. Rà ngày 25/08 tìm thấy đúng 166 hồ sơ
 * và 13 cán bộ ở tình trạng ấy. Cờ này so `rowHash` rồi ghi đè bản đã lệch.
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** PHẢI khớp `stage.ts` — đổi là nhân đôi toàn bộ hồ sơ. */
const LEGACY_KEY_VERSION = 'v2-collection-prefixed';
const BATCH = 500;

/** Tên collection suy từ tên tệp, giống `stage.ts`. */
function collectionOf(fileName: string): string {
  return path.basename(fileName).replace(/\.(ejsonl|bson|json)$/i, '');
}

/**
 * Gỡ bọc Extended JSON về giá trị thường, để bản thô trong bảng chờ giống hệt
 * thứ mà đường `.bson` tạo ra — `import.ts` đọc chung một hình dạng.
 */
function unwrapEjson(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(unwrapEjson);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1) {
      const k = keys[0];
      const inner = o[k];
      if (k === '$numberInt' || k === '$numberLong') return Number(inner);
      if (k === '$numberDouble' || k === '$numberDecimal') return Number(inner);
      if (k === '$oid') return String(inner);
      if (k === '$date') {
        if (typeof inner === 'object' && inner && '$numberLong' in (inner as object)) {
          return new Date(Number((inner as Record<string, unknown>)['$numberLong'])).toISOString();
        }
        return typeof inner === 'number' ? new Date(inner).toISOString() : String(inner);
      }
      if (k === '$undefined') return null;
    }
    const out: Record<string, unknown> = {};
    for (const [kk, vv] of Object.entries(o)) out[kk] = unwrapEjson(vv);
    return out;
  }
  return v;
}

function fileChecksum(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function rowHashOf(doc: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(doc)).digest('hex');
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const file = arg('--file');
  const apply = process.argv.includes('--apply');
  const refreshChanged = process.argv.includes('--refresh-changed');

  if (!file || !fs.existsSync(file)) {
    console.error(`Không thấy tệp: ${file ?? '(chưa truyền --file)'}`);
    process.exit(1);
  }

  const collection = collectionOf(file);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  let runId = '(chưa tạo — chế độ chỉ đọc)';

  console.log(`\n=== Nạp bảng chờ từ .ejsonl — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===`);
  console.log(`Tệp        : ${file}`);
  console.log(`Collection : ${collection}`);
  console.log(`Nạp lại bản đã sửa: ${refreshChanged ? 'có' : 'KHÔNG (chỉ thêm mới)'}\n`);

  try {
    if (apply) {
      // Ghi sổ lần chạy như đường `.bson`, để dấu vết kiểm toán không bị đứt đoạn.
      const run = await prisma.legacyImportRun.create({
        data: {
          sourceChecksums: { [path.basename(file)]: fileChecksum(file) },
          legacyKeyVersion: LEGACY_KEY_VERSION,
          status: 'RUNNING',
          note: `Nạp bù từ .ejsonl (${collection}) — đường .bson không dùng được vì máy không có mongodump.`,
        },
      });
      runId = run.id;
    }

    // Đã có gì trong bảng chờ, kèm VÂN TAY — để phân biệt ba trường hợp: chưa có, có và
    // giống hệt, có nhưng hệ cũ đã sửa.
    const daCo = new Map<string, string>();
    for (const r of await prisma.legacyStaging.findMany({
      where: { sourceFile: collection },
      select: { sourceId: true, rowHash: true },
    })) {
      daCo.set(r.sourceId, r.rowHash);
    }
    console.log(`Bảng chờ hiện có: ${daCo.size.toLocaleString('vi-VN')} hồ sơ của "${collection}"`);

    let doc = 0;
    let moi = 0;
    let daBo = 0;
    let khongCoId = 0;
    let daGhi = 0;
    let daLech = 0;
    let daCapNhat = 0;
    let buffer: Record<string, unknown>[] = [];

    async function flush(): Promise<void> {
      if (!buffer.length) return;
      if (apply) {
        const r = await prisma.legacyStaging.createMany({
          data: buffer as never,
          skipDuplicates: true,
        });
        daGhi += r.count;
      }
      buffer = [];
    }

    const rl = require('readline').createInterface({
      input: fs.createReadStream(file, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl as AsyncIterable<string>) {
      const t = line.trim();
      if (!t) continue;
      doc++;

      let raw: Record<string, unknown>;
      try {
        raw = unwrapEjson(JSON.parse(t)) as Record<string, unknown>;
      } catch {
        khongCoId++;
        continue;
      }

      const sourceId = raw['id'] != null ? String(raw['id']) : null;
      if (!sourceId) {
        khongCoId++;
        continue;
      }

      const vanTay = rowHashOf(raw);
      const vanTayCu = daCo.get(sourceId);

      if (vanTayCu !== undefined) {
        if (vanTayCu === vanTay) {
          daBo++;
          continue;
        }
        // Đã có nhưng hệ cũ đã sửa. Đây là dạng sót mà đếm số lượng KHÔNG thấy.
        daLech++;
        if (refreshChanged) {
          if (apply) {
            await prisma.legacyStaging.updateMany({
              where: { sourceFile: collection, sourceId },
              data: { raw: raw as never, rowHash: vanTay, runId },
            });
            daCapNhat++;
          }
        } else {
          daBo++;
        }
        continue;
      }

      moi++;

      buffer.push({
        // KHÔNG tự đặt `id`: lược đồ khai @default(cuid()) và `stage.ts` cũng để Prisma
        // sinh. Khoá tự nhiên chống trùng là (sourceFile, sourceId) — đúng thứ mà
        // skipDuplicates dựa vào.
        runId,
        sourceFile: collection,
        sourceId,
        rowHash: vanTay,
        raw,
      });
      if (buffer.length >= BATCH) await flush();
    }
    await flush();

    console.log(`\n--- Kết quả ---`);
    console.log(`Đọc được       : ${doc.toLocaleString('vi-VN')} dòng`);
    console.log(`Bỏ qua (y hệt) : ${daBo.toLocaleString('vi-VN')}`);
    console.log(
      `Hệ cũ đã sửa   : ${daLech.toLocaleString('vi-VN')}` +
        (refreshChanged
          ? ` → ${apply ? 'đã cập nhật ' + daCapNhat.toLocaleString('vi-VN') : 'sẽ cập nhật'}`
          : ' → BỎ QUA (thêm --refresh-changed để đồng bộ)'),
    );
    console.log(`Không có mã    : ${khongCoId.toLocaleString('vi-VN')}`);
    console.log(`${apply ? 'Đã ghi' : 'Sẽ ghi'}         : ${apply ? daGhi.toLocaleString('vi-VN') : moi.toLocaleString('vi-VN')}`);

    if (apply) {
      await prisma.legacyImportRun.update({
        where: { id: runId },
        data: { status: 'DONE', finishedAt: new Date(), counts: { staged: daGhi } },
      });
      const sau = await prisma.legacyStaging.count({ where: { sourceFile: collection } });
      console.log(`Bảng chờ sau   : ${sau.toLocaleString('vi-VN')} hồ sơ`);
      console.log(`\nBước tiếp theo: chạy import.ts để đưa từ bảng chờ vào bảng vận hành.`);
    } else {
      console.log(`\n(Chế độ CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
