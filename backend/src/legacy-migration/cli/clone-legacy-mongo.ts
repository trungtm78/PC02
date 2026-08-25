/**
 * clone-legacy-mongo.ts — nhân bản NGUYÊN TRẠNG cơ sở dữ liệu hệ cũ sang một MongoDB khác.
 *
 * KHÁC với `backup-legacy-to-postgres.ts`: bản kia đổi sang PostgreSQL nên tài liệu thành
 * `jsonb` — tra cứu được nhưng KHÔNG chạy lại được hệ cũ. Tệp này giữ đúng MongoDB, đúng
 * kiểu BSON (`ObjectId`, `Date`, `Long`, `Decimal128`…) và chép cả **chỉ mục**, nên bản đích
 * là một bản sao chạy được của hệ cũ chứ không chỉ là dữ liệu đọc tham khảo.
 *
 * Vì sao không dùng `mongodump`/`mongorestore`: bộ công cụ ấy là gói tải riêng, không nằm
 * trong bản MongoDB Community. Trình điều khiển Node đã có sẵn trong dự án và giữ nguyên
 * kiểu BSON y hệt, nên không cần thêm phụ thuộc.
 *
 * NGUỒN CHỈ ĐỌC — không một lệnh ghi nào chạm vào hệ cũ.
 *
 * Dùng: SOURCE_MONGO_URI=... TARGET_MONGO_URI=... \
 *       ts-node clone-legacy-mongo.ts [--drop] [--no-indexes]
 *
 *   --drop        xoá collection ở ĐÍCH trước khi chép (mặc định: có, để chạy lại giống nhau)
 *   --keep        giữ dữ liệu đích, chỉ thêm (ngược với --drop)
 *   --no-indexes  bỏ qua bước chép chỉ mục
 */
import { MongoClient, type Document } from 'mongodb';

const BATCH = 1000;

interface Report {
  name: string;
  nguon: number;
  dich: number;
  chiMuc: number;
  khop: boolean;
}

async function main(): Promise<void> {
  const sourceUri = process.env['SOURCE_MONGO_URI'];
  const targetUri = process.env['TARGET_MONGO_URI'];
  if (!sourceUri || !targetUri) {
    console.error('LỖI: cần cả SOURCE_MONGO_URI và TARGET_MONGO_URI. KHÔNG hardcode trong repo.');
    process.exit(1);
  }
  const sourceDb = process.env['SOURCE_MONGO_DB'] || 'pc02';
  const targetDb = process.env['TARGET_MONGO_DB'] || sourceDb;
  const giuDich = process.argv.includes('--keep');
  const boChiMuc = process.argv.includes('--no-indexes');

  const src = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 30_000 });
  const dst = new MongoClient(targetUri, { serverSelectionTimeoutMS: 30_000 });
  await src.connect();
  await dst.connect();

  const S = src.db(sourceDb);
  const D = dst.db(targetDb);

  const names = (await S.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  console.log(`\nNguồn : ${sourceDb} — ${names.length} collection`);
  console.log(`Đích  : ${targetDb} — chế độ ${giuDich ? 'GIỮ dữ liệu đích' : 'XOÁ rồi chép lại'}\n`);

  const reports: Report[] = [];
  let tongDoc = 0;
  let tongChiMuc = 0;

  for (const name of names) {
    const from = S.collection(name);
    const to = D.collection(name);
    const nguon = await from.countDocuments();

    // MongoDB chỉ sinh collection ở lần GHI đầu tiên, nên collection RỖNG ở nguồn sẽ không
    // bao giờ xuất hiện ở đích. Số tài liệu vẫn khớp, nhưng bản sao thiếu 12 collection và
    // không còn giống hệt về cấu trúc. Tạo tường minh để bản sao là bản sao thật.
    await D.createCollection(name).catch(() => undefined);

    if (!giuDich) await to.deleteMany({});

    let daChep = 0;
    let buffer: Document[] = [];
    const flush = async (): Promise<void> => {
      if (!buffer.length) return;
      // `ordered: false` để một tài liệu hỏng không chặn cả lô; số cuối vẫn được đối chiếu.
      await to.insertMany(buffer, { ordered: false });
      daChep += buffer.length;
      buffer = [];
    };

    for await (const doc of from.find({})) {
      buffer.push(doc);
      if (buffer.length >= BATCH) await flush();
    }
    await flush();

    // Chỉ mục quyết định hệ cũ chạy nhanh hay treo. Bỏ qua `_id_` vì MongoDB tự tạo.
    let soChiMuc = 0;
    if (!boChiMuc) {
      const idx = await from.indexes();
      for (const i of idx) {
        if (i.name === '_id_') continue;
        const { key, name: tenIdx, v: _v, ns: _ns, ...opts } = i as Record<string, unknown>;
        try {
          await to.createIndex(key as never, { name: tenIdx as string, ...(opts as object) });
          soChiMuc++;
        } catch (e) {
          console.log(`    (chỉ mục "${String(tenIdx)}" không tạo được: ${(e as Error).message.split('\n')[0]})`);
        }
      }
    }

    const dich = await to.countDocuments();
    const khop = dich === nguon;
    reports.push({ name, nguon, dich, chiMuc: soChiMuc, khop });
    tongDoc += dich;
    tongChiMuc += soChiMuc;

    console.log(
      `  ${khop ? 'OK  ' : 'LỆCH'} ${name.padEnd(26)} nguồn=${String(nguon).padStart(6)} đích=${String(dich).padStart(6)} chỉ mục=${soChiMuc}`,
    );
  }

  const lech = reports.filter((r) => !r.khop);
  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`Collection : ${reports.length}`);
  console.log(`Tài liệu   : ${tongDoc.toLocaleString('vi-VN')}`);
  console.log(`Chỉ mục    : ${tongChiMuc}`);
  if (lech.length) {
    console.log(`\n⚠️  ${lech.length} collection LỆCH:`);
    for (const r of lech) console.log(`    ${r.name}: nguồn ${r.nguon}, đích ${r.dich}`);
  } else {
    console.log(`\n>>> KHỚP TUYỆT ĐỐI — 0 collection lệch`);
  }

  await src.close();
  await dst.close();
  if (lech.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
