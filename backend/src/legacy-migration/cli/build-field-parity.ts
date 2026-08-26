/**
 * build-field-parity.ts — MA TRẬN FIELD-PARITY chuẩn (deliverable "quyết định field").
 *
 * Khác `build-field-mapping.ts` (dùng freq toàn cục) và `field-gap.ts` (phân nhóm thô):
 * CLI này đối chiếu 3 nguồn sự thật cho MỖI (field × thực thể-CÓ-DATA):
 *   1. Số hồ sơ CÓ DATA cho field, TÁCH theo thực thể đích (join legacySourceId → cases/incidents/petitions).
 *   2. Cột thật của thực thể (Prisma DMMF) + bảng map `field-mapping.seed.ts`.
 *   3. Builder nào ĐỌC key nào (đọc thẳng mã `legacy-mapper.ts`).
 *
 * Trạng thái mỗi (field, thực thể-có-data):
 *   RESOLVE       — field cần biến đổi đặc biệt (đã có đích, không cột thẳng).
 *   OK            — có cột typed đúng + builder đã đổ.
 *   FIX_BUILDER   — cột đã tồn tại nhưng builder KHÔNG đọc field → chỉ cần đọc nốt.
 *   METADATA_ONLY — builder đọc vào metadata JSON, CHƯA có cột typed riêng → theo chỉ thị: THÊM CỘT.
 *   MAT_KIEU      — có cột nhận nhưng cột CHỨA KHÔNG NỔI kiểu của field (vd chữ đổ vào cột
 *                   đúng/sai) → phần không vừa bốc hơi → THÊM CỘT đúng kiểu.
 *   NEEDS_COLUMN  — không cột, không builder đọc → THÊM CỘT + đổ builder + backfill.
 *   DROP          — field kỹ thuật, cố ý bỏ.
 *
 * Output:
 *   docs/legacy/field-parity-matrix.md   (người duyệt)
 *   docs/legacy/field-parity-matrix.json (PR-2/3/6 tiêu thụ: builder gen, backfill, GATE)
 *
 * Dùng:  set -a && source .env && set +a
 *        ./node_modules/.bin/ts-node src/legacy-migration/cli/build-field-parity.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { builderTargets } from './builder-targets';
import { phanLoaiO, STATUS_CAN_COT, type Entity, type Status } from './parity-classify';
import {
  PETITION_MAP,
  INCIDENT_MAP,
  CASE_MAP,
  CASE_STATISTIC_MAP,
  RESOLVE,
  DROP_PATTERNS,
} from './field-mapping.seed';

const ENTITY_MAP: Record<Entity, Record<string, string>> = {
  petition: PETITION_MAP,
  incident: INCIDENT_MAP,
  case: { ...CASE_MAP, ...CASE_STATISTIC_MAP },
};

/**
 * Cột thật của mỗi thực thể (gộp Case+CaseStatistic cho 'case') KÈM KIỂU, lấy từ DMMF.
 *
 * Kiểu là phần bộ sinh cũ không đọc, nên nó chỉ trả lời được "cột có tồn tại không" chứ
 * không trả lời được "cột có chứa nổi không" — xem `parity-classify.ts`.
 */
function dmmfColumns(): Record<Entity, Map<string, string>> {
  const cols = (name: string): [string, string][] => {
    const m = Prisma.dmmf.datamodel.models.find((x) => x.name === name);
    return m
      ? m.fields
          .filter((f) => f.kind === 'scalar' || f.kind === 'enum')
          // Cột enum chứa được một tập giá trị đóng; coi như chữ để không báo động giả.
          .map((f) => [f.name, f.kind === 'enum' ? 'String' : String(f.type)] as [string, string])
      : [];
  };
  return {
    petition: new Map(cols('Petition')),
    incident: new Map(cols('Incident')),
    case: new Map([...cols('Case'), ...cols('CaseStatistic')]),
  };
}

/** Field kỹ thuật / đã xử lý qua trace/compose — KHÔNG cần cột nghiệp vụ mới. */
const HANDLED = new Set([
  '_id', 'id', '_add_time', '_update_time', '__v', 'da_xoa', 'da_nhan', 'don_vi_id', 'nguoi_them',
  'stt', 'stt_cu', // → soHoSoCu/sttCu (traceability)
  'nam', 'thang', 'ngay', // thành phần ngày — ghép, đối chiếu (GROUP2 field-gap)
  'loai', // cờ nội bộ nền tảng cũ (không phải loai_thong_tin)
]);

/** kieu_du_lieu (TruongTuyChinh) → kiểu Prisma cho cột mới (an toàn lossless: date→DateTime?, số→Int?, checkbox→Boolean?, còn lại String?). */
function prismaType(kieu: string): 'String' | 'DateTime' | 'Int' | 'Boolean' {
  const k = (kieu || '').toLowerCase();
  if (k === 'date' || k.includes('ngay')) return 'DateTime';
  if (k === 'number' || k === 'so') return 'Int';
  if (k === 'checkbox' || k === 'bool') return 'Boolean';
  return 'String';
}

const DROP = (f: string): boolean => DROP_PATTERNS.some((re) => re.test(f));

async function main(): Promise<void> {
  const docs = path.resolve(__dirname, '../../../../docs/legacy');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    const dmmf = dmmfColumns();
    const targets = builderTargets();

    // Nhãn + kiểu từ định nghĩa trường hệ cũ.
    const defs = await prisma.legacyStaging.findMany({ where: { sourceFile: 'TruongTuyChinh' }, select: { raw: true } });
    const label = new Map<string, { ten: string; kieu: string }>();
    for (const d of defs) {
      const r = d.raw as Record<string, unknown>;
      const k = String(r.ten_truong ?? '').trim();
      if (k) label.set(k, { ten: String(r.ten_hien_thi ?? ''), kieu: String(r.kieu_du_lieu ?? '') });
    }

    // Đếm field CÓ DATA, tách theo thực thể đích thật.
    const rows = await prisma.$queryRaw<{ raw: any; l: string }[]>`
      SELECT s.raw,
             CASE WHEN EXISTS (SELECT 1 FROM cases c     WHERE c."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'case'
                  WHEN EXISTS (SELECT 1 FROM incidents i WHERE i."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'incident'
                  WHEN EXISTS (SELECT 1 FROM petitions p WHERE p."legacySourceId" = s."sourceFile"||':'||s."sourceId") THEN 'petition'
                  ELSE 'none' END AS l
      FROM legacy_staging s WHERE s."sourceFile" IN ('ho_so_doi_1','ho_so')`;

    // cnt[field][entity] = số hồ sơ có data
    const cnt: Record<string, Record<Entity, number>> = {};
    for (const r of rows) {
      if (r.l === 'none') continue;
      const ent = r.l as Entity;
      for (const [k, v] of Object.entries(r.raw as Record<string, unknown>)) {
        if (/_search$/.test(k)) continue;
        if (v === null || v === undefined || v === '' || v === 0 || v === false) continue;
        const c = (cnt[k] ??= { petition: 0, incident: 0, case: 0 });
        c[ent]++;
      }
    }

    interface Cell { entity: Entity; count: number; status: Status; column: string | null; newColumn?: { name: string; type: string } }
    interface FieldRow { field: string; label: string; kieu: string; total: number; cells: Cell[] }

    const out: FieldRow[] = [];
    for (const [field, per] of Object.entries(cnt)) {
      const lb = label.get(field);
      const total = per.petition + per.incident + per.case;
      const cells: Cell[] = [];
      for (const entity of ['petition', 'incident', 'case'] as Entity[]) {
        const count = per[entity];
        if (count === 0) continue;
        if (DROP(field) || HANDLED.has(field)) { cells.push({ entity, count, status: 'DROP', column: null }); continue; }
        // Cột THẬT do builder đổ (nguồn sự thật), fallback hand-map nếu builder chưa đọc.
        const mapCol = ENTITY_MAP[entity][field] ?? null;
        const { status, column } = phanLoaiO({
          field,
          targets: targets[entity].get(field) ?? [],
          cotThat: dmmf[entity],
          mapCol,
          laResolve: Boolean(RESOLVE[field]),
          kieuHeCu: lb?.kieu ?? '',
        });
        const newColumn = STATUS_CAN_COT.has(status)
          ? { name: '?', type: prismaType(lb?.kieu ?? '') }
          : undefined;
        cells.push({ entity, count, status, column, newColumn });
      }
      if (cells.length) out.push({ field, label: lb?.ten ?? '', kieu: lb?.kieu ?? '', total, cells });
    }
    out.sort((a, b) => b.total - a.total);

    // Tổng hợp: field×thực thể cần THÊM CỘT.
    const needCol = out.flatMap((r) => r.cells.filter((c) => STATUS_CAN_COT.has(c.status)).map((c) => ({ field: r.field, label: r.label, kieu: r.kieu, ...c })));
    const needFix = out.flatMap((r) => r.cells.filter((c) => c.status === 'FIX_BUILDER').map((c) => ({ field: r.field, label: r.label, ...c })));

    fs.writeFileSync(path.join(docs, 'field-parity-matrix.json'), JSON.stringify({ generatedAtIso: new Date().toISOString(), rows: out, needColumn: needCol, needFix }, null, 2));

    // ── Markdown review ──────────────────────────────────────────────────
    const pct = (n: number, tot: number) => (tot ? ((n / tot) * 100).toFixed(1) + '%' : '0%');
    const totalRecords = rows.filter((r) => r.l !== 'none').length;
    const md: string[] = [
      '# Ma trận FIELD-PARITY (field cũ × thực thể → cột hệ mới)',
      '',
      `> Sinh từ data thật: ${totalRecords} hồ sơ đã di trú. Mỗi ô = (field có data ở thực thể đó) → trạng thái cột.`,
      '> **METADATA_ONLY** + **NEEDS_COLUMN** = phải THÊM CỘT typed (chỉ thị: mọi field có data → cột).',
      '',
      '## ⚠️ CẦN THÊM CỘT (field có data, chưa có cột typed riêng ở thực thể đó)',
      '',
      '| Field | Nhãn | Thực thể | Số HS | Trạng thái | Kiểu đề xuất |',
      '|---|---|---|---|---|---|',
      ...needCol.map((c) => `| \`${c.field}\` | ${c.label} | **${c.entity}** | ${c.count} | ${c.status} | ${c.newColumn?.type}? |`),
      '',
      `Tổng ô cần thêm cột: **${needCol.length}** (theo thực thể: petition ${needCol.filter((c) => c.entity === 'petition').length}, incident ${needCol.filter((c) => c.entity === 'incident').length}, case ${needCol.filter((c) => c.entity === 'case').length}).`,
      '',
      '## 🔧 CẦN FIX BUILDER (cột đã có, builder chưa đọc)',
      '',
      '| Field | Nhãn | Thực thể | Số HS | Cột đích |',
      '|---|---|---|---|---|',
      ...needFix.map((c) => `| \`${c.field}\` | ${c.label} | ${c.entity} | ${c.count} | ${c.column} |`),
      '',
      `Tổng ô cần fix builder: **${needFix.length}**.`,
      '',
      '## Toàn bộ field (sắp theo tổng số hồ sơ có data)',
      '',
      '| Field | Nhãn | Tổng | Petition | Incident | Case |',
      '|---|---|---|---|---|---|',
      ...out.map((r) => {
        const cell = (e: Entity) => {
          const c = r.cells.find((x) => x.entity === e);
          return c ? `${c.status}${c.column ? ` (${c.column})` : ''} · ${c.count}` : '—';
        };
        return `| \`${r.field}\` | ${r.label} | ${r.total} | ${cell('petition')} | ${cell('incident')} | ${cell('case')} |`;
      }),
    ];
    fs.writeFileSync(path.join(docs, 'field-parity-matrix.md'), md.join('\n') + '\n');

    // ── Console tóm tắt ──────────────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const r of out) for (const c of r.cells) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    console.log(`[parity] ${out.length} field có data · ô theo trạng thái:`, byStatus);
    console.log(`[parity] CẦN THÊM CỘT: ${needCol.length} ô · CẦN FIX BUILDER: ${needFix.length} ô`);
    console.log(`[parity] → docs/legacy/field-parity-matrix.{md,json}`);
    for (const e of ['petition', 'incident', 'case'] as Entity[]) {
      const list = needCol.filter((c) => c.entity === e);
      if (list.length) console.log(`\n  ${e} cần thêm ${list.length} cột:\n    ` + list.map((c) => `${c.field}(${c.count},${c.newColumn?.type})`).join('\n    '));
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
