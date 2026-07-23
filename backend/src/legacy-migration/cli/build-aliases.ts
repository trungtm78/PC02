/**
 * Dựng bảng alias đơn vị từ dữ liệu trong bảng chờ, rồi báo cáo độ phủ theo SỐ HỒ SƠ.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/build-aliases.ts        # ghi bảng alias
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/build-aliases.ts --dry  # chỉ báo cáo
 *
 * Đây là bước CHUẨN BỊ, chưa đụng vào hồ sơ. Sản phẩm là danh sách đề xuất để người có
 * thẩm quyền duyệt: mục nào còn UNKNOWN mà chiếm nhiều hồ sơ thì preflight sẽ chặn nạp.
 *
 * Đo độ phủ theo SỐ HỒ SƠ chứ không theo số cách viết: 3.703 cách viết nhưng phân bố
 * rất lệch (riêng "Đội 8" đã 12.857 hồ sơ), nên đếm theo cách viết sẽ cho cảm giác sai
 * về mức độ hoàn thành.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { teamMatchKey } from './org-mapper';
import { classifyUnitValue, groupRawValues, type AliasKind } from './unit-alias';

interface AliasReport {
  distinctValues: number;
  totalRecords: number;
  byKind: Record<AliasKind, { values: number; records: number }>;
  topUnknown: { sample: string; count: number; reason: string }[];
  written: number;
}

export async function buildAliases(prisma: PrismaClient, dryRun: boolean): Promise<AliasReport> {
  // Đếm theo từng cách viết ngay trong CSDL — 53.820 dòng JSONB, không kéo hết về Node.
  const rows = await prisma.$queryRaw<{ value: string | null; count: bigint }[]>`
    SELECT raw->>'don_vi_giai_quyet' AS value, count(*)::bigint AS count
    FROM legacy_staging
    WHERE "sourceFile" IN ('ho_so_doi_1', 'ho_so')
    GROUP BY 1
  `;
  const grouped = groupRawValues(rows.map((r) => ({ value: r.value, count: Number(r.count) })));

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const teamIdByKey = new Map(teams.map((t) => [teamMatchKey(t.name), t.id]));
  const teamKeys = new Set(teamIdByKey.keys());

  const rep: AliasReport = {
    distinctValues: grouped.size,
    totalRecords: 0,
    byKind: {
      TEAM: { values: 0, records: 0 },
      EXTERNAL_ORG: { values: 0, records: 0 },
      RESULT: { values: 0, records: 0 },
      UNKNOWN: { values: 0, records: 0 },
    },
    topUnknown: [],
    written: 0,
  };

  for (const [normKey, { sample, count }] of grouped) {
    const cls = classifyUnitValue(sample, teamKeys);
    rep.totalRecords += count;
    rep.byKind[cls.kind].values++;
    rep.byKind[cls.kind].records += count;
    if (cls.kind === 'UNKNOWN') rep.topUnknown.push({ sample, count, reason: cls.reason });

    if (!dryRun) {
      const teamId = cls.teamKey ? (teamIdByKey.get(cls.teamKey) ?? null) : null;
      // Chỉ ghi đè mục CHƯA ai duyệt — quyết định thủ công của người dùng luôn thắng
      // kết quả đoán tự động, kể cả khi chạy lại bộ sinh này.
      const existing = await prisma.legacyUnitAlias.findUnique({ where: { rawValue: normKey } });
      if (existing?.approvedBy) continue;
      await prisma.legacyUnitAlias.upsert({
        where: { rawValue: normKey },
        create: { rawValue: normKey, sampleRaw: sample, kind: cls.kind, teamId, recordCount: count, note: cls.reason },
        update: { sampleRaw: sample, kind: cls.kind, teamId, recordCount: count, note: cls.reason },
      });
      rep.written++;
    }
  }

  rep.topUnknown.sort((a, b) => b.count - a.count);
  return rep;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    const r = await buildAliases(prisma, dryRun);
    const pct = (n: number) => `${((100 * n) / (r.totalRecords || 1)).toFixed(2)}%`;
    console.log(dryRun ? '\n— CHẠY THỬ, KHÔNG GHI GÌ —\n' : '\n— ĐÃ GHI BẢNG ALIAS —\n');
    console.log(`${r.distinctValues} cách viết khác nhau · ${r.totalRecords} hồ sơ có ghi đơn vị\n`);
    console.log('Nhóm            | cách viết |   hồ sơ | tỉ lệ hồ sơ');
    console.log('----------------+-----------+---------+------------');
    for (const k of ['TEAM', 'EXTERNAL_ORG', 'RESULT', 'UNKNOWN'] as AliasKind[]) {
      const v = r.byKind[k];
      console.log(`${k.padEnd(15)} | ${String(v.values).padStart(9)} | ${String(v.records).padStart(7)} | ${pct(v.records).padStart(11)}`);
    }
    console.log(`\n15 giá trị CHƯA phân loại được, nhiều hồ sơ nhất:`);
    for (const u of r.topUnknown.slice(0, 15)) {
      console.log(`  ${String(u.count).padStart(6)}  ${JSON.stringify(u.sample.slice(0, 60))}  — ${u.reason}`);
    }
    if (!dryRun) console.log(`\nĐã ghi ${r.written} mục vào bảng alias.`);
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
