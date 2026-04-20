/**
 * Seed feature flags for the PC02 case management modules.
 *
 * Two ways to run:
 *   1. Directly: `npx ts-node prisma/seed-feature-flags.ts` (uses its own client)
 *   2. From prisma/seed.ts which imports `seedFeatureFlags(prisma)` — this is
 *      the path the deploy pipeline hits via `npm run db:seed`, so a fresh
 *      environment always ends up with rows in feature_flags.
 *
 * Idempotent. On UPDATE we refresh label/description/domain (derived from
 * code) but we DO NOT touch `enabled`, so operator runtime toggles are preserved.
 *
 * Single source of truth: FEATURE_REGISTRY in src/feature-flags/feature-registry.ts.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { FEATURE_REGISTRY } from '../src/feature-flags/feature-registry';

export async function seedFeatureFlags(prisma: PrismaClient): Promise<number> {
  for (const m of FEATURE_REGISTRY) {
    await prisma.featureFlag.upsert({
      where: { key: m.key },
      update: {
        label: m.label,
        description: m.description ?? null,
        domain: m.domain,
        // note: DO NOT update `enabled` — operator toggles are sacred.
      },
      create: {
        key: m.key,
        label: m.label,
        description: m.description ?? null,
        domain: m.domain,
        enabled: true,
      },
    });
  }
  return FEATURE_REGISTRY.length;
}

// Standalone CLI entry point. Only runs when invoked directly (not when imported).
if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const prisma = new PrismaClient({ adapter });

  seedFeatureFlags(prisma)
    .then((count) => {
      // eslint-disable-next-line no-console
      console.log(`✔ Seeded ${count} feature flags`);
    })
    .catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
