/**
 * mongo-export.ts — Export dữ liệu án từ MongoDB LIVE hệ cũ pc02hcm.com (db `pc02`)
 * ra Extended JSON canonical (.ejsonl), NGOÀI git (tránh rò rỉ PII).
 *
 * An toàn:
 *  - Credential CHỈ đọc từ ENV `LEGACY_MONGO_URI` (không hardcode, không log).
 *  - Read-only: chỉ `find`/`countDocuments`, không ghi Mongo.
 *  - Snapshot check: count đầu == count cuối == số ghi ra (reconcileSnapshot).
 *  - EJSON canonical: bảo toàn ObjectId/Date/Long/Decimal128.
 *
 * Dùng:
 *   LEGACY_MONGO_URI="mongodb://<user>:<pass>@host:27017" \
 *   LEGACY_DUMP_DIR="C:/PC02/legacy-dumps/2026" \
 *   npx ts-node src/legacy-migration/cli/mongo-export.ts
 *
 * Report (an toàn để commit) ghi ở docs/legacy/reconcile-counts.md + manifest.json (chỉ count/checksum).
 */
import { MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { toEjsonLine, reconcileSnapshot, LEGACY_COLLECTIONS } from './mongo-export.util';

const DB_NAME = process.env.LEGACY_DB_NAME || 'pc02';
const BATCH = Number(process.env.LEGACY_EXPORT_BATCH || 500);

interface CollectionReport {
  name: string;
  countStart: number;
  countEnd: number;
  written: number;
  ok: boolean;
  reason?: string;
  sha256: string;
  file: string;
}

function fmtTs(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

async function resolveCollections(db: import('mongodb').Db): Promise<string[]> {
  const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  const wanted = new Set(LEGACY_COLLECTIONS);
  // Thêm mọi collection TamDinhChi_vu_viec_* (theo đơn vị) có thật.
  for (const name of existing) {
    if (/^TamDinhChi_vu_viec_/.test(name)) wanted.add(name);
  }
  // Chỉ giữ collection tồn tại thật.
  return [...wanted].filter((n) => existing.includes(n));
}

async function exportCollection(
  db: import('mongodb').Db,
  name: string,
  outDir: string,
): Promise<CollectionReport> {
  const coll = db.collection(name);
  const countStart = await coll.countDocuments();
  const file = path.join(outDir, `${name}.ejsonl`);
  const out = fs.createWriteStream(file, { encoding: 'utf8' });
  const hash = crypto.createHash('sha256');

  let written = 0;
  const cursor = coll.find({}, { sort: { _id: 1 }, batchSize: BATCH, noCursorTimeout: true });
  try {
    for await (const doc of cursor) {
      const line = toEjsonLine(doc) + '\n';
      out.write(line);
      hash.update(line);
      written++;
    }
  } finally {
    await cursor.close();
    await new Promise<void>((res) => out.end(res));
  }

  const countEnd = await coll.countDocuments();
  const { ok, reason } = reconcileSnapshot({ countStart, countEnd, written });
  return { name, countStart, countEnd, written, ok, reason, sha256: hash.digest('hex'), file };
}

async function main(): Promise<void> {
  const uri = process.env.LEGACY_MONGO_URI;
  if (!uri) {
    console.error('LỖI: thiếu ENV LEGACY_MONGO_URI. KHÔNG hardcode credential trong repo.');
    process.exit(1);
  }
  const dumpRoot = process.env.LEGACY_DUMP_DIR || path.resolve('C:/PC02/legacy-dumps');
  const outDir = path.join(dumpRoot, fmtTs(new Date()));
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[mongo-export] DB=${DB_NAME} → ${outDir}`); // KHÔNG in URI (chứa credential)
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
  const reports: CollectionReport[] = [];
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collections = await resolveCollections(db);
    console.log(`[mongo-export] ${collections.length} collection: ${collections.join(', ')}`);
    for (const name of collections) {
      const r = await exportCollection(db, name, outDir);
      const flag = r.ok ? 'OK ' : 'WARN';
      console.log(`  [${flag}] ${name.padEnd(26)} start=${r.countStart} end=${r.countEnd} written=${r.written}${r.reason ? ' — ' + r.reason : ''}`);
      reports.push(r);
    }
  } finally {
    await client.close();
  }

  // Manifest (an toàn commit — chỉ count + checksum, KHÔNG dữ liệu)
  const manifest = {
    db: DB_NAME,
    exportedAtIso: new Date().toISOString(),
    outDir,
    collections: reports.map(({ name, countStart, countEnd, written, ok, reason, sha256 }) => ({
      name, countStart, countEnd, written, ok, reason: reason ?? null, sha256,
    })),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Report markdown vào repo (docs/legacy) — chỉ số liệu.
  const repoDocs = path.resolve('docs/legacy');
  fs.mkdirSync(repoDocs, { recursive: true });
  const biCan = reports.find((r) => r.name === 'bi_can');
  const lines = [
    '# Đối soát export legacy Mongo',
    '',
    `- DB: \`${DB_NAME}\` | Export: ${manifest.exportedAtIso}`,
    `- Thư mục dump (NGOÀI git): \`${outDir}\``,
    `- \`bi_can\`: ${biCan ? `${biCan.written} doc` : 'KHÔNG có'} ${biCan && biCan.written > 0 ? '✅ (dump cũ rỗng, live có dữ liệu)' : '⚠️'}`,
    '',
    '| Collection | count đầu | count cuối | ghi ra | OK |',
    '|---|---|---|---|---|',
    ...reports.map((r) => `| ${r.name} | ${r.countStart} | ${r.countEnd} | ${r.written} | ${r.ok ? '✅' : '⚠️ ' + (r.reason ?? '')} |`),
  ];
  fs.writeFileSync(path.join(repoDocs, 'reconcile-counts.md'), lines.join('\n') + '\n');

  const bad = reports.filter((r) => !r.ok);
  console.log(`\n[mongo-export] XONG. ${reports.length} collection, ${bad.length} cảnh báo. Report: docs/legacy/reconcile-counts.md`);
  if (bad.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error('[mongo-export] LỖI:', e?.message || e);
  process.exit(1);
});
