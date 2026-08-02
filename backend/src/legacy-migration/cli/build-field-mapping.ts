/**
 * build-field-mapping.ts — Sinh MA TRẬN MAP field (deliverable "quyết định field").
 *
 * Đọc catalog `field-catalog.generated.json` + bảng seed `field-mapping.seed.ts` →
 * với mỗi field ho_so: đích là cột nào (petition/incident/case/caseStatistic),
 * hay RESOLVE đặc biệt, hay DROP, hay UNMAPPED (cần quyết: thêm cột / metadata / bỏ).
 *
 * Output:
 *  - docs/legacy/field-mapping.md   (review — sắp theo tần suất, UNMAPPED nổi bật)
 *  - docs/legacy/field-mapping.json (config builder PR-3)
 *
 * Dùng: npx ts-node cli/build-field-mapping.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  PETITION_MAP,
  INCIDENT_MAP,
  CASE_MAP,
  CASE_STATISTIC_MAP,
  RESOLVE,
  DROP_PATTERNS,
  PHAN_LOAI_TO_ENTITY,
} from './field-mapping.seed';

interface CatalogField {
  tenTruong: string;
  tenHienThi: string;
  kieuDuLieu: string;
  batBuoc: boolean;
  freq: number;
}

type Classification = 'MAPPED' | 'RESOLVE' | 'DROP' | 'UNMAPPED';

function classify(field: string): {
  klass: Classification;
  targets: Record<string, string>;
  note?: string;
} {
  if (DROP_PATTERNS.some((re) => re.test(field))) return { klass: 'DROP', targets: {} };
  if (RESOLVE[field]) return { klass: 'RESOLVE', targets: {}, note: RESOLVE[field] };
  const targets: Record<string, string> = {};
  if (PETITION_MAP[field]) targets.petition = PETITION_MAP[field];
  if (INCIDENT_MAP[field]) targets.incident = INCIDENT_MAP[field];
  if (CASE_MAP[field]) targets.case = CASE_MAP[field];
  if (CASE_STATISTIC_MAP[field]) targets.caseStatistic = CASE_STATISTIC_MAP[field];
  return { klass: Object.keys(targets).length ? 'MAPPED' : 'UNMAPPED', targets };
}

function main(): void {
  const docs = path.resolve(__dirname, '../../../../docs/legacy');
  const catalog = JSON.parse(fs.readFileSync(path.join(docs, 'field-catalog.generated.json'), 'utf8'));
  const fields: CatalogField[] = catalog.fields.ho_so;
  const total: number = catalog.totalHoSo;

  const rows = fields
    .map((f) => ({ f, ...classify(f.tenTruong) }))
    .sort((a, b) => b.f.freq - a.f.freq);

  const counts = { MAPPED: 0, RESOLVE: 0, DROP: 0, UNMAPPED: 0 };
  for (const r of rows) counts[r.klass]++;

  // JSON cho builder
  const json = {
    generatedAtIso: new Date().toISOString(),
    phanLoaiToEntity: PHAN_LOAI_TO_ENTITY,
    byEntity: { petition: PETITION_MAP, incident: INCIDENT_MAP, case: CASE_MAP, caseStatistic: CASE_STATISTIC_MAP },
    resolve: RESOLVE,
    rows: rows.map((r) => ({ field: r.f.tenTruong, label: r.f.tenHienThi, type: r.f.kieuDuLieu, freq: r.f.freq, klass: r.klass, targets: r.targets, note: r.note ?? null })),
  };
  fs.writeFileSync(path.join(docs, 'field-mapping.json'), JSON.stringify(json, null, 2));

  // MD review
  const fmtTargets = (t: Record<string, string>) => Object.entries(t).map(([e, c]) => `${e}.${c}`).join(' · ');
  const unmapped = rows.filter((r) => r.klass === 'UNMAPPED');
  const md = [
    '# Ma trận MAP field cũ → hệ mới (quyết định field)',
    '',
    `> Sinh từ catalog + \`field-mapping.seed.ts\`. Tổng ${fields.length} field ho_so / ${total} hồ sơ.`,
    `> MAPPED ${counts.MAPPED} · RESOLVE ${counts.RESOLVE} · DROP ${counts.DROP} · **UNMAPPED ${counts.UNMAPPED}**`,
    '',
    '## ⚠️ UNMAPPED tần suất cao — CẦN QUYẾT (thêm cột / metadata / bỏ)',
    '',
    '| Field | Nhãn | Kiểu | Có DL | % | Đề xuất |',
    '|---|---|---|---|---|---|',
    ...unmapped.slice(0, 40).map((r) => {
      const pct = total ? ((r.f.freq / total) * 100).toFixed(1) : '0';
      const suggest = r.f.freq / total > 0.2 ? 'THÊM CỘT (dùng nhiều)' : 'metadata';
      return `| \`${r.f.tenTruong}\` | ${r.f.tenHienThi} | ${r.f.kieuDuLieu} | ${r.f.freq} | ${pct}% | ${suggest} |`;
    }),
    '',
    '## Toàn bộ field (sắp theo tần suất)',
    '',
    '| Field | Nhãn | % | Loại | Đích |',
    '|---|---|---|---|---|',
    ...rows.map((r) => {
      const pct = total ? ((r.f.freq / total) * 100).toFixed(1) : '0';
      const dest = r.klass === 'MAPPED' ? fmtTargets(r.targets) : r.klass === 'RESOLVE' ? r.note : r.klass;
      return `| \`${r.f.tenTruong}\` | ${r.f.tenHienThi} | ${pct}% | ${r.klass} | ${dest} |`;
    }),
  ];
  fs.writeFileSync(path.join(docs, 'field-mapping.md'), md.join('\n') + '\n');
  console.log(`[mapping] MAPPED=${counts.MAPPED} RESOLVE=${counts.RESOLVE} DROP=${counts.DROP} UNMAPPED=${counts.UNMAPPED} → docs/legacy/field-mapping.md`);
}

main();
