/**
 * P1-003 fix: Idempotent feature_flags seed runner.
 * Invoked from scripts/deploy/deploy.sh AFTER atomic symlink switch + AFTER systemctl restart + AFTER health check.
 *
 * Behavior:
 *   1. Connect via same DATABASE_URL as app (PrismaPg adapter, reuses app's env handling).
 *   2. SELECT COUNT(*) FROM feature_flags.
 *   3. If count = 0 → run seedFeatureFlags() from existing seed-feature-flags.ts.
 *   4. If count > 0 → skip (already seeded, no-op).
 *   5. Exit 0 on success, exit 1 on error.
 *
 * Why Node (not psql per ENG-5): psql may not be on $PATH on Viettel VM (postgres user only).
 * DATABASE_URL escape issues with @ or ? in bash. Node uses same Prisma adapter as app — guaranteed compat.
 *
 * Usage: cd /home/pc02/current/backend && npx ts-node prisma/seed-features-if-empty.ts
 */

import 'dotenv/config'; // auto-load .env from cwd (backend/.env via deploy.sh)
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedFeatureFlags } from './seed-feature-flags';

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[seed-features-if-empty] DATABASE_URL missing');
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.featureFlag.count();
    if (count > 0) {
      console.log(`[seed-features-if-empty] feature_flags has ${count} rows — skipping (idempotent)`);
      return;
    }
    console.log('[seed-features-if-empty] feature_flags empty — running seedFeatureFlags()...');
    await seedFeatureFlags(prisma);
    const after = await prisma.featureFlag.count();
    console.log(`[seed-features-if-empty] seeded ${after} feature_flags rows`);
  } catch (e) {
    console.error('[seed-features-if-empty] FAILED:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
