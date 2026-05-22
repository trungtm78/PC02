/**
 * Admin-units snapshot re-seed runner (v0.37.0.2).
 *
 * Orchestrates seedAdminUnits with optional flags:
 *   --dry-run     Verify dataset file + checksum, no DB writes. Used by CI smoke.
 *   --force       UPDATE ledger ACTIVE/IMPORTING → SUPERSEDED before re-import.
 *                 Use when ledger says ACTIVE but DB state suggests partial import.
 *   --clean-slate DELETE all WARD+PROVINCE directories first (legacy seedWards migration).
 *                 One-time use when DB has pre-reform commune data (~10k wards). Implies --force.
 *
 * Used by:
 *   - scripts/deploy/deploy.sh Step 9c (FATAL — deploy fails on seed error)
 *   - .github/workflows/ci.yml backend-test job (--dry-run smoke)
 *   - Manual `npm run db:seed:admin-units -- --clean-slate` for one-time legacy migration
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedAdminUnits, loadDataset, CURRENT_VERSION, type SeedResult } from './seed-admin-units';

export interface RunSeedOpts {
  prisma: PrismaClient;
  force?: boolean;
  dryRun?: boolean;
  cleanSlate?: boolean;
}

export interface RunSeedResult {
  dryRun?: boolean;
  cleaned?: number;
  result?: SeedResult;
}

export async function runSeed(opts: RunSeedOpts): Promise<RunSeedResult> {
  const { prisma, force, dryRun, cleanSlate } = opts;

  if (dryRun) {
    loadDataset(CURRENT_VERSION); // verifies file readable + SHA256 checksum
    return { dryRun: true };
  }

  let cleaned: number | undefined;
  if (cleanSlate) {
    const r = await prisma.directory.deleteMany({
      where: { type: { in: ['WARD', 'PROVINCE'] } },
    });
    cleaned = r.count;
  }

  if (force || cleanSlate) {
    await prisma.adminUnitDatasetImport.updateMany({
      where: { status: { in: ['ACTIVE', 'IMPORTING'] } },
      data: { status: 'SUPERSEDED' },
    });
  }

  const result = await seedAdminUnits(prisma);
  return cleaned !== undefined ? { cleaned, result } : { result };
}

// CLI entry — invoked via `npx ts-node prisma/seed-admin-units-runner.ts [flags]`
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');
    const cleanSlate = args.includes('--clean-slate');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('[seed-admin-units-runner] DATABASE_URL missing');
      process.exit(1);
    }

    const adapter = new PrismaPg({ connectionString: dbUrl });
    const prisma = new PrismaClient({ adapter });

    try {
      const out = await runSeed({ prisma, force, dryRun, cleanSlate });
      if (out.dryRun) {
        console.log(`[seed-admin-units-runner] --dry-run OK: ${CURRENT_VERSION} dataset valid`);
      } else {
        if (out.cleaned !== undefined) {
          console.log(`[seed-admin-units-runner] --clean-slate: deleted ${out.cleaned} legacy rows`);
        }
        console.log('[seed-admin-units-runner] Result:', JSON.stringify(out.result, null, 2));
      }
    } catch (e) {
      console.error('[seed-admin-units-runner] Failed:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
