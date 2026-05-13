/**
 * Standalone runner for seedEventCategories — invokable via:
 *   npx ts-node prisma/seed-event-categories-runner.ts
 *
 * Created 2026-05-13 to fix production P3009: v0.20 phase 3 migration
 * (drop_holiday) requires event_categories to be seeded but the auto-deploy
 * pipeline doesn't run seed scripts. This runner lets us seed via the
 * recover-migration GitHub Actions workflow without needing direct SSH.
 *
 * Idempotent (seed-event-categories.ts uses upsert by slug).
 */
import { PrismaClient } from '@prisma/client';
import { seedEventCategories } from './seed-event-categories';

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await seedEventCategories(prisma);
    console.log(`✓ Seeded ${count} event categories (idempotent upsert by slug)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed event_categories failed:', err);
  process.exit(1);
});
