/**
 * One-time production data migration: normalize Case.metadata.district slugs.
 *
 * Old frontend used hardcoded DISTRICT_OPTIONS with kebab-case slugs (e.g., "quan-1").
 * Directory codes use uppercase codes (e.g., "Q1").
 * This script normalizes existing case records so metadata.district matches Directory.code.
 *
 * Run after prisma migrate deploy:
 *   npx ts-node backend/prisma/migrations/20260425000002_normalize_case_district_slugs/migrate-district-slugs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG_TO_CODE: Record<string, string> = {
  'quan-1': 'Q1',
  'quan-3': 'Q3',
  'quan-5': 'Q5',
  'quan-7': 'Q7',
  'quan-10': 'Q10',
  'quan-12': 'Q12',
  'quan-tan-binh': 'QTB',
  'quan-binh-thanh': 'QBTH',
  'quan-phu-nhuan': 'QPN',
  'quan-thu-duc': 'QTD',
};

async function main() {
  console.log('🔄 Normalizing Case.metadata.district slugs...');

  for (const [slug, code] of Object.entries(SLUG_TO_CODE)) {
    const count = await prisma.$executeRaw`
      UPDATE cases
      SET metadata = jsonb_set(metadata, '{district}', ${JSON.stringify(code)}::jsonb)
      WHERE metadata->>'district' = ${slug}
    `;
    if (Number(count) > 0) {
      console.log(`   ${slug} → ${code}: ${count} rows updated`);
    }
  }

  // Warn about any unrecognized slugs still in the DB
  const unrecognized = await prisma.$queryRaw<{ district: string; cnt: bigint }[]>`
    SELECT metadata->>'district' AS district, COUNT(*) AS cnt
    FROM cases
    WHERE metadata->>'district' IS NOT NULL
      AND metadata->>'district' NOT IN (${Object.values(SLUG_TO_CODE).join("','")})
      AND metadata->>'district' != ''
    GROUP BY metadata->>'district'
  `;

  if (unrecognized.length > 0) {
    console.warn('⚠️  Unrecognized district slugs (manual review needed):');
    for (const row of unrecognized) {
      console.warn(`   "${row.district}": ${row.cnt} cases`);
    }
  } else {
    console.log('   ✓ No unrecognized slugs found');
  }

  console.log('✅ Done');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
