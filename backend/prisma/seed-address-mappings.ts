/**
 * Seed AddressMapping table từ dữ liệu crawl (address-mappings-hcm.json)
 * Idempotent: upsert theo unique constraint (oldWard + oldDistrict + province)
 *
 * Run: npx ts-node prisma/seed-address-mappings.ts
 * Or called from seed.ts via seedAddressMappings(prisma)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface MappingEntry {
  oldWard: string;
  oldDistrict: string;
  newWard: string;
  province: string;
  note?: string;
  needsReview?: boolean;
}

const DATA_FILE = join(__dirname, 'data/address-mappings-hcm.json');

export async function seedAddressMappings(prismaClient: PrismaClient): Promise<void> {
  if (!existsSync(DATA_FILE)) {
    console.warn('  ⚠️  address-mappings-hcm.json not found — run: node scripts/crawl-address-mappings.mjs');
    return;
  }

  const mappings: MappingEntry[] = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  console.log(`Seeding ${mappings.length} address mappings...`);

  let created = 0;
  let existing = 0;

  for (const m of mappings) {
    const result = await prismaClient.addressMapping.upsert({
      where: {
        oldWard_oldDistrict_province: {
          oldWard: m.oldWard,
          oldDistrict: m.oldDistrict,
          province: m.province,
        },
      },
      update: {
        newWard: m.newWard,
        note: m.note,
        needsReview: m.needsReview ?? false,
      },
      create: {
        oldWard: m.oldWard,
        oldDistrict: m.oldDistrict,
        newWard: m.newWard,
        province: m.province,
        note: m.note,
        needsReview: m.needsReview ?? false,
        isActive: true,
      },
    });

    const timeDiff = result.updatedAt.getTime() - result.createdAt.getTime();
    if (timeDiff < 1000) created++;
    else existing++;
  }

  console.log(`Address mappings done. ${created} created, ${existing} already existed.`);
  console.log(`  TPHCM mappings: ${mappings.filter(m => m.province === 'HCM').length}`);
  console.log(`  Needs review: ${mappings.filter(m => m.needsReview).length}`);
}

// Standalone mode
if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const standaloneClient = new PrismaClient({ adapter });
  seedAddressMappings(standaloneClient)
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => standaloneClient.$disconnect());
}
