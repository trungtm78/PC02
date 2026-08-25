/**
 * backup-legacy-to-postgres.ts — sao lưu TOÀN BỘ cơ sở dữ liệu hệ cũ (MongoDB) sang một
 * PostgreSQL cục bộ, nguyên văn, không biến đổi.
 *
 * KHÁC với đường di trú: đường kia CHỌN LỌC 15 collection và BIẾN ĐỔI chúng thành bảng
 * nghiệp vụ. Tệp này không chọn lọc và không biến đổi — nó chụp lại mọi collection, kể cả
 * phần rác của phần mềm bán hàng mà hệ cũ dùng chung (`SanPham_VatTu`, `phieu_thu`…), vì
 * mục đích của bản sao lưu là *giữ được thứ mình chưa biết là cần*.
 *
 * Mỗi collection thành một bảng `legacy_<tên>` với:
 *   • `doc`     jsonb  — nguyên văn tài liệu
 *   • `mongo_id` text  — `_id` gốc, khoá chính (ổn định, không phụ thuộc thứ tự đọc)
 *   • `legacy_id` text — trường `id` nghiệp vụ của hệ cũ, có đánh chỉ mục để tra
 *
 * CHỈ ĐỌC ở phía hệ cũ. Không bao giờ ghi ngược.
 *
 * Dùng: LEGACY_MONGO_URI=... BACKUP_PG_URL=postgres://... ts-node backup-legacy-to-postgres.ts
 */
import { MongoClient } from 'mongodb';
import { Client } from 'pg';

const BATCH = 500;

/** Tên bảng an toàn cho Postgres: chữ thường, chỉ chữ/số/gạch dưới. */
function tableNameOf(collection: string): string {
  return 'legacy_' + collection.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

async function main(): Promise<void> {
  const mongoUri = process.env['LEGACY_MONGO_URI'];
  const pgUrl = process.env['BACKUP_PG_URL'];
  if (!mongoUri || !pgUrl) {
    console.error('LỖI: cần cả LEGACY_MONGO_URI và BACKUP_PG_URL. KHÔNG hardcode trong repo.');
    process.exit(1);
  }
  const dbName = process.env['LEGACY_MONGO_DB'] || 'pc02';

  const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 20_000 });
  const pg = new Client({ connectionString: pgUrl });

  await mongo.connect();
  await pg.connect();
  const db = mongo.db(dbName);

  // Sổ ghi lượt sao lưu — để lần sau biết bản này chụp lúc nào và có đủ không.
  await pg.query(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id           bigserial PRIMARY KEY,
      started_at   timestamptz NOT NULL DEFAULT now(),
      finished_at  timestamptz,
      source_db    text NOT NULL,
      collections  int,
      documents    bigint,
      note         text
    )`);
  const run = await pg.query(
    `INSERT INTO backup_runs (source_db, note) VALUES ($1, $2) RETURNING id`,
    [dbName, 'Sao lưu toàn bộ hệ cũ, nguyên văn'],
  );
  const runId = run.rows[0].id as string;

  const colls = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  console.log(`Nguồn: MongoDB db="${dbName}" — ${colls.length} collection\n`);

  let tongDoc = 0;
  let tongColl = 0;

  for (const name of colls) {
    const table = tableNameOf(name);
    const coll = db.collection(name);
    const dem = await coll.countDocuments();

    await pg.query(`
      CREATE TABLE IF NOT EXISTS "${table}" (
        mongo_id  text PRIMARY KEY,
        legacy_id text,
        doc       jsonb NOT NULL
      )`);
    await pg.query(`CREATE INDEX IF NOT EXISTS "${table}_legacy_id_idx" ON "${table}" (legacy_id)`);
    // Chạy lại phải cho kết quả y hệt, nên xoá sạch bảng trước khi chép.
    await pg.query(`TRUNCATE "${table}"`);

    let daChep = 0;
    let buffer: [string, string | null, string][] = [];

    async function flush(): Promise<void> {
      if (!buffer.length) return;
      const vals: string[] = [];
      const params: unknown[] = [];
      buffer.forEach((row, i) => {
        const b = i * 3;
        vals.push(`($${b + 1}, $${b + 2}, $${b + 3}::jsonb)`);
        params.push(row[0], row[1], row[2]);
      });
      await pg.query(
        `INSERT INTO "${table}" (mongo_id, legacy_id, doc) VALUES ${vals.join(',')}
         ON CONFLICT (mongo_id) DO UPDATE SET legacy_id = EXCLUDED.legacy_id, doc = EXCLUDED.doc`,
        params,
      );
      daChep += buffer.length;
      buffer = [];
    }

    for await (const doc of coll.find({})) {
      const d = doc as Record<string, unknown>;
      buffer.push([
        String(d['_id']),
        d['id'] != null ? String(d['id']) : null,
        JSON.stringify(d),
      ]);
      if (buffer.length >= BATCH) await flush();
    }
    await flush();

    const sau = await pg.query(`SELECT count(*)::int AS n FROM "${table}"`);
    const khop = sau.rows[0].n === dem;
    console.log(
      `  ${khop ? 'OK  ' : 'LỆCH'} ${name.padEnd(26)} hệ cũ=${String(dem).padStart(6)} đã chép=${String(daChep).padStart(6)} trong bảng=${String(sau.rows[0].n).padStart(6)}`,
    );
    if (!khop) {
      throw new Error(`Sao lưu KHÔNG khớp ở "${name}": hệ cũ ${dem}, bảng ${sau.rows[0].n}. Dừng để không tạo bản sao lưu sai.`);
    }
    tongDoc += daChep;
    tongColl++;
  }

  await pg.query(
    `UPDATE backup_runs SET finished_at = now(), collections = $2, documents = $3 WHERE id = $1`,
    [runId, tongColl, tongDoc],
  );

  console.log(`\n=== XONG ===`);
  console.log(`Collection : ${tongColl}`);
  console.log(`Tài liệu   : ${tongDoc.toLocaleString('vi-VN')}`);

  await mongo.close();
  await pg.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
