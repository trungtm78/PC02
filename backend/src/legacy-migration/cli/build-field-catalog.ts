/**
 * build-field-catalog.ts — Sinh CATALOG FIELD data-driven từ dump EJSON hệ cũ.
 *
 * Nguồn (đã export bởi mongo-export.ts):
 *  - TruongTuyChinh.ejsonl → định nghĩa field động (nhãn/kiểu/bắt buộc/options/loai/đơn vị)
 *  - NgonNgu.ejsonl        → enum code→nhãn (loai_ho_so, phan_loai_ho_so_doi_1, tinh_trang_*)
 *  - ho_so_doi_1.ejsonl    → đo TẦN SUẤT thực mỗi field (bao nhiêu / 54k hồ sơ có giá trị)
 *
 * Output (an toàn commit — chỉ metadata field, KHÔNG dữ liệu án):
 *  - docs/legacy/field-catalog.generated.md
 *  - docs/legacy/field-catalog.generated.json
 *
 * Dùng: LEGACY_DUMP_DIR="C:/PC02/legacy-dumps/<ts>" npx ts-node cli/build-field-catalog.ts
 * (không set → tự tìm thư mục dump mới nhất trong C:/PC02/legacy-dumps)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { parseEjsonLine } from './mongo-export.util';
import { parseTruongField, parseNgonNguEnum, mergeByFieldName, MergedField } from './build-field-catalog.util';

function latestDumpDir(): string {
  const explicit = process.env.LEGACY_DUMP_DIR;
  if (explicit && fs.existsSync(path.join(explicit, 'ho_so_doi_1.ejsonl'))) return explicit;
  const root = process.env.LEGACY_DUMP_ROOT || 'C:/PC02/legacy-dumps';
  const subs = fs.existsSync(root)
    ? fs.readdirSync(root).map((d) => path.join(root, d)).filter((p) => fs.statSync(p).isDirectory())
    : [];
  const withData = subs.filter((p) => fs.existsSync(path.join(p, 'TruongTuyChinh.ejsonl')));
  withData.sort();
  if (!withData.length) throw new Error(`Không tìm thấy dump có TruongTuyChinh.ejsonl trong ${root}`);
  return withData[withData.length - 1];
}

function readEjsonl(file: string): Record<string, any>[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => parseEjsonLine(l) as Record<string, any>);
}

function isNonEmpty(v: any): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

async function countFrequency(file: string, keys: string[]): Promise<{ total: number; freq: Record<string, number> }> {
  const freq: Record<string, number> = {};
  for (const k of keys) freq[k] = 0;
  let total = 0;
  if (!fs.existsSync(file)) return { total, freq };
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    let doc: Record<string, any>;
    try {
      doc = parseEjsonLine(line) as Record<string, any>;
    } catch {
      continue;
    }
    for (const k of keys) if (isNonEmpty(doc[k])) freq[k]++;
  }
  return { total, freq };
}

async function main(): Promise<void> {
  const dir = latestDumpDir();
  console.log(`[catalog] dump: ${dir}`);

  const truong = readEjsonl(path.join(dir, 'TruongTuyChinh.ejsonl')).map(parseTruongField);
  const merged = mergeByFieldName(truong);
  const enums = readEjsonl(path.join(dir, 'NgonNgu.ejsonl')).map(parseNgonNguEnum).filter((e) => e.ten);

  const hoSoFields = merged.filter((f) => f.loai === 'ho_so');
  const biCanFields = merged.filter((f) => f.loai === 'bi_can');
  const dtbsFields = merged.filter((f) => f.loai === 'dieu_tra_bo_sung');

  // Tần suất thực trên ho_so_doi_1 (nguồn án chính)
  const { total, freq } = await countFrequency(
    path.join(dir, 'ho_so_doi_1.ejsonl'),
    hoSoFields.map((f) => f.tenTruong),
  );
  console.log(`[catalog] đo tần suất trên ${total} hồ sơ ho_so_doi_1`);

  const enumOfInterest = enums.filter((e) => /loai_ho_so|phan_loai_ho_so_doi_1|tinh_trang/.test(e.ten));

  // JSON
  const json = {
    generatedAtIso: new Date().toISOString(),
    source: path.basename(dir),
    totalHoSo: total,
    fields: {
      ho_so: hoSoFields.map((f) => ({ ...f, freq: freq[f.tenTruong] ?? 0 })),
      bi_can: biCanFields,
      dieu_tra_bo_sung: dtbsFields,
    },
    enums: enumOfInterest,
  };
  // Anchor ở repo-root/docs/legacy (script chạy từ backend/ nên không dùng CWD).
  const outDir = path.resolve(__dirname, '../../../../docs/legacy');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'field-catalog.generated.json'), JSON.stringify(json, null, 2));

  // Markdown
  const md: string[] = [
    '# Catalog field hệ cũ (data-driven từ TruongTuyChinh + NgonNgu)',
    '',
    `> Sinh tự động từ dump \`${path.basename(dir)}\`. Tần suất đo trên ${total} hồ sơ \`ho_so_doi_1\`.`,
    '',
    `## Field \`ho_so\` (${hoSoFields.length} field) — sắp theo tần suất`,
    '',
    '| ten_truong | Nhãn (ten_hien_thi) | Kiểu | Bắt buộc | Có DL / tổng | % | Options | Xung đột |',
    '|---|---|---|---|---|---|---|---|',
    ...hoSoFields
      .map((f) => ({ f, n: freq[f.tenTruong] ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .map(({ f, n }) => {
        const pct = total ? ((n / total) * 100).toFixed(1) : '0';
        const opts = f.options.length ? f.options.map((o) => o.tenHienThi || o.giaTri).join(' / ') : '';
        return `| \`${f.tenTruong}\` | ${f.tenHienThi} | ${f.kieuDuLieu} | ${f.batBuoc ? '✓' : ''} | ${n}/${total} | ${pct}% | ${opts.slice(0, 60)} | ${f.conflicts.join('; ')} |`;
      }),
    '',
    `## Field \`bi_can\` (${biCanFields.length} định nghĩa — LƯU Ý: collection bi_can RỖNG, không có dữ liệu)`,
    '',
    '| ten_truong | Nhãn | Kiểu | Bắt buộc |',
    '|---|---|---|---|',
    ...biCanFields.map((f) => `| \`${f.tenTruong}\` | ${f.tenHienThi} | ${f.kieuDuLieu} | ${f.batBuoc ? '✓' : ''} |`),
    '',
    `## Field \`dieu_tra_bo_sung\` (${dtbsFields.length})`,
    '',
    '| ten_truong | Nhãn | Kiểu |',
    '|---|---|---|',
    ...dtbsFields.map((f) => `| \`${f.tenTruong}\` | ${f.tenHienThi} | ${f.kieuDuLieu} |`),
    '',
    '## Enum (NgonNgu) then chốt',
    '',
    ...enumOfInterest.flatMap((e) => [
      `### \`${e.ten}\``,
      Object.entries(e.values).map(([k, v]) => `- \`${k}\` → ${v}`).join('\n'),
      '',
    ]),
  ];
  fs.writeFileSync(path.join(outDir, 'field-catalog.generated.md'), md.join('\n') + '\n');
  console.log(`[catalog] XONG. ho_so=${hoSoFields.length} field, bi_can=${biCanFields.length}, dtbs=${dtbsFields.length}, enum=${enumOfInterest.length}. → docs/legacy/field-catalog.generated.md`);
}

main().catch((e) => {
  console.error('[catalog] LỖI:', e?.message || e);
  process.exit(1);
});
