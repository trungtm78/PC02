/**
 * Nạp dump BSON hệ cũ vào bảng chờ `legacy_staging` — NGUYÊN VĂN, không biến đổi gì.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/stage.ts --dir "C:/PC02/docs/requirements/DB" \
 *       --files ho_so_doi_1.bson,ho_so.bson,chi_nhanh.bson,thanh_vien.bson,ToiDanh.bson
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/stage.ts --resume <runId>
 *
 * Vì sao phải có bước này: mọi biến đổi (chuẩn hoá ngày, ánh xạ đơn vị, tách thực thể)
 * diễn ra SAU khi bản thô đã nằm trong CSDL. Sửa luật ánh xạ chỉ cần chạy lại từ bảng
 * chờ, không phải đọc lại 411MB BSON.
 *
 * An toàn khi chết giữa chừng: mỗi lô ghi xong mới cập nhật `lastBatchNo`; chạy lại với
 * `--resume` sẽ bỏ qua các lô đã ghi. Đổi quy tắc sinh khoá giữa chừng thì bị TỪ CHỐI —
 * chạy tiếp với khoá khác sẽ nhân đôi toàn bộ hồ sơ.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readBsonFile, type BsonDoc } from './bson-reader';

/** Phiên bản quy tắc sinh `legacySourceId`. Đổi giá trị này là buộc phải nạp lại từ đầu. */
export const LEGACY_KEY_VERSION = 'v2-collection-prefixed';

export const DEFAULT_BATCH_SIZE = 500;

/** Tên collection = tên file bỏ đuôi `.bson`. Dùng làm tiền tố khoá chống trùng. */
export function collectionOf(fileName: string): string {
  return path.basename(fileName).replace(/\.bson$/i, '');
}

/** Băm nội dung một document để phát hiện nạp trùng trong cùng lần chạy. */
export function rowHashOf(doc: BsonDoc): string {
  return crypto.createHash('sha256').update(JSON.stringify(doc)).digest('hex');
}

/** Băm cả file nguồn — chốt "bản thô nào đã được nạp", để đối chiếu về sau. */
export function fileChecksum(filePath: string): string {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    let pos = 0;
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      h.update(buf.subarray(0, n));
      pos += n;
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

/**
 * Lấy id của document. Hệ cũ dùng cột `id` số nguyên; `_id` (ObjectId) chỉ là khoá kỹ thuật.
 * Không có `id` thì lùi về `_id` để KHÔNG mất bản ghi.
 */
export function sourceIdOf(doc: BsonDoc): string | undefined {
  const raw = doc.id ?? doc._id;
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw).trim();
  return s === '' ? undefined : s;
}

/** Cắt một mảng thành các lô kích thước cố định. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Kích thước lô phải > 0');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface StageOptions {
  dir: string;
  files: string[];
  batchSize?: number;
  resumeRunId?: string;
}

export interface StageResult {
  runId: string;
  staged: number;
  skippedNoId: number;
  perFile: Record<string, number>;
}

function parseArgs(argv: string[]): StageOptions {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dir = get('dir') ?? 'C:/PC02/docs/requirements/DB';
  const filesArg = get('files');
  const files = filesArg
    ? filesArg.split(',').map((f) => f.trim()).filter(Boolean)
    : fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.bson'));
  return {
    dir,
    files,
    batchSize: Number(get('batch') ?? DEFAULT_BATCH_SIZE),
    resumeRunId: get('resume'),
  };
}

export async function stage(prisma: PrismaClient, opts: StageOptions): Promise<StageResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  // ── Sổ chạy: mở mới hoặc chạy tiếp ────────────────────────────────────────
  let run: { id: string; lastBatchNo: number };
  if (opts.resumeRunId) {
    const found = await prisma.legacyImportRun.findUnique({ where: { id: opts.resumeRunId } });
    if (!found) throw new Error(`Không tìm thấy lần chạy ${opts.resumeRunId}`);
    if (found.legacyKeyVersion !== LEGACY_KEY_VERSION) {
      // Chạy tiếp bằng quy tắc khoá khác sẽ tạo bản ghi mới bên cạnh bản cũ thay vì
      // cập nhật — nhân đôi toàn bộ dữ liệu một cách âm thầm.
      throw new Error(
        `TỪ CHỐI chạy tiếp: lần chạy dùng quy tắc khoá "${found.legacyKeyVersion}", ` +
          `mã hiện tại dùng "${LEGACY_KEY_VERSION}". Phải nạp lại từ đầu bằng lần chạy mới.`,
      );
    }
    run = { id: found.id, lastBatchNo: found.lastBatchNo };
    console.log(`Chạy tiếp lần chạy ${run.id} — đã xong ${run.lastBatchNo} lô.`);
  } else {
    const checksums: Record<string, string> = {};
    for (const f of opts.files) checksums[f] = fileChecksum(path.join(opts.dir, f));
    const created = await prisma.legacyImportRun.create({
      data: { sourceChecksums: checksums, legacyKeyVersion: LEGACY_KEY_VERSION, status: 'RUNNING' },
    });
    run = { id: created.id, lastBatchNo: 0 };
    console.log(`Lần chạy mới: ${run.id}`);
  }

  const result: StageResult = { runId: run.id, staged: 0, skippedNoId: 0, perFile: {} };
  let batchNo = 0;

  try {
    for (const file of opts.files) {
      const full = path.join(opts.dir, file);
      const collection = collectionOf(file);
      let buffer: { runId: string; sourceFile: string; sourceId: string; rowHash: string; raw: BsonDoc }[] = [];
      let fileCount = 0;

      const flush = async () => {
        if (!buffer.length) return;
        batchNo++;
        // Lô đã ghi ở lần chạy trước thì bỏ qua — không đọc lại DB để kiểm từng dòng.
        if (batchNo <= run.lastBatchNo) {
          buffer = [];
          return;
        }
        // skipDuplicates: chạy lại cùng lô không ném lỗi mà bỏ qua dòng đã có.
        const written = await prisma.legacyStaging.createMany({ data: buffer as never, skipDuplicates: true });
        result.staged += written.count;
        fileCount += written.count;
        await prisma.legacyImportRun.update({ where: { id: run.id }, data: { lastBatchNo: batchNo } });
        buffer = [];
      };

      for (const doc of readBsonFile(full)) {
        const sourceId = sourceIdOf(doc);
        if (!sourceId) {
          result.skippedNoId++;
          continue;
        }
        buffer.push({ runId: run.id, sourceFile: collection, sourceId, rowHash: rowHashOf(doc), raw: doc });
        if (buffer.length >= batchSize) await flush();
      }
      await flush();
      result.perFile[collection] = fileCount;
      console.log(`  ${file} → ${fileCount} bản ghi`);
    }

    await prisma.legacyImportRun.update({
      where: { id: run.id },
      data: { status: 'DONE', finishedAt: new Date(), counts: result.perFile },
    });
  } catch (e) {
    await prisma.legacyImportRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', note: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }

  return result;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const t0 = Date.now();
    const r = await stage(prisma, opts);
    console.log(
      `\nXong: ${r.staged} bản ghi vào bảng chờ, ${r.skippedNoId} bản ghi không có id (bỏ qua), ` +
        `${((Date.now() - t0) / 1000).toFixed(1)} giây. Lần chạy: ${r.runId}`,
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
