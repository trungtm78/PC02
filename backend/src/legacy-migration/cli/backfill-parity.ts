/**
 * backfill-parity.ts — Điền 55 cột field-parity MỚI (PR-2) cho bản ghi ĐÃ di trú
 * (di trú xảy ra TRƯỚC khi có cột → cột đang NULL).
 *
 * Nguồn: `legacyRaw` (bản gốc bất biến) → parse qua CHÍNH `parityColumns()` của mapper
 * (cùng logic parseLegacyDate/Number/bool) → bảo đảm giống hệt di trú mới.
 *
 * AN TOÀN: idempotent — CHỈ set cột đang NULL (không đè giá trị đã có / sửa tay).
 * legacyRaw không đụng tới.
 *
 * Dùng:  set -a && source .env && set +a
 *        ./node_modules/.bin/ts-node src/legacy-migration/cli/backfill-parity.ts [--entity petition|incident|case] [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parityColumns } from '../legacy-mapper';
import { PARITY, type Entity } from '../field-parity.def';

const MODEL: Record<Entity, string> = { petition: 'petition', incident: 'incident', case: 'case' };

async function backfillEntity(prisma: PrismaClient, entity: Entity, dry: boolean): Promise<{ scanned: number; updated: number; cellsSet: number }> {
  const cols = PARITY[entity].map((c) => c.col);
  const delegate = (prisma as any)[MODEL[entity]];
  const select: Record<string, boolean> = { id: true, legacyRaw: true };
  for (const c of cols) select[c] = true;

  let cursor: string | undefined;
  let scanned = 0;
  let updated = 0;
  let cellsSet = 0;
  const BATCH = 1000;
  for (;;) {
    const rows: any[] = await delegate.findMany({
      where: { legacyRaw: { not: null } },
      select,
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned++;
      const parsed = parityColumns(row.legacyRaw as Record<string, unknown>, entity);
      // CHỈ set cột đang NULL trong DB (idempotent, không đè sửa tay).
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== undefined && v !== null && (row[k] === null || row[k] === undefined)) data[k] = v;
      }
      const keys = Object.keys(data);
      if (keys.length === 0) continue;
      cellsSet += keys.length;
      updated++;
      if (!dry) await delegate.update({ where: { id: row.id }, data });
    }
    cursor = rows[rows.length - 1].id;
    if (scanned % 5000 < BATCH) console.log(`  [${entity}] scanned ${scanned}, updated ${updated}, cells ${cellsSet}${dry ? ' (DRY)' : ''}`);
    if (rows.length < BATCH) break;
  }
  return { scanned, updated, cellsSet };
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const eArg = process.argv.indexOf('--entity');
  const only = eArg >= 0 ? (process.argv[eArg + 1] as Entity) : undefined;
  const entities: Entity[] = only ? [only] : ['petition', 'incident', 'case'];
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  try {
    for (const e of entities) {
      console.log(`\n=== backfill-parity: ${e}${dry ? ' (DRY-RUN)' : ''} ===`);
      const r = await backfillEntity(prisma, e, dry);
      console.log(`[${e}] DONE — scanned ${r.scanned}, updated ${r.updated}, cells set ${r.cellsSet}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
