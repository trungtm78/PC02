/**
 * Builds the render-ready grid model (`dyn_report_version_grids`) for every
 * published or retired report version that does not have a current one.
 *
 * The endpoint builds a model lazily on first request, so this is never
 * required for correctness; it exists so the first officer to open a report
 * after the deploy does not pay for the build, and so a changed extraction
 * (a new GRID_ENGINE_VERSION) can be re-applied across every version at once.
 *
 * Default is a DRY RUN: it only lists what it would build. Pass --apply to
 * write. Builds run one at a time through the same bounded worker the endpoint
 * uses, so a backfill cannot starve live requests of memory.
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only scripts/backfill-dr-grids.ts            # list
 *   npx ts-node --transpile-only scripts/backfill-dr-grids.ts --apply    # build
 *   npx ts-node --transpile-only scripts/backfill-dr-grids.ts --apply --limit=20
 *
 * Exit code 1 if any version failed to build (they are listed).
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { GridModelService } from '../src/dynamic-reports/grid/grid-model.service';
import { GRID_ENGINE_VERSION } from '../src/dynamic-reports/engine/grid-types';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Math.max(1, Number(limitArg)) : Infinity;

  const prisma = new PrismaService();
  await prisma.$connect();
  const grids = new GridModelService(prisma);

  try {
    const versions = await prisma.dynReportVersion.findMany({
      where: { status: { in: ['PUBLISHED', 'RETIRED'] } },
      select: {
        id: true,
        version: true,
        sha256: true,
        fileName: true,
        report: { select: { code: true } },
        grid: { select: { gridEngineVersion: true, sourceSha256: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const stale = versions.filter(
      (v) =>
        !v.grid ||
        v.grid.gridEngineVersion !== GRID_ENGINE_VERSION ||
        v.grid.sourceSha256 !== v.sha256,
    );
    console.log(
      `${versions.length} published/retired versions, ${stale.length} without a current grid (engine v${GRID_ENGINE_VERSION}).`,
    );
    if (stale.length === 0) return;

    const todo = stale.slice(0, limit);
    if (!apply) {
      for (const v of todo) console.log(`  would build  ${v.report.code} v${v.version}  (${v.fileName})`);
      console.log('Dry run — pass --apply to build.');
      return;
    }

    let built = 0;
    const failed: string[] = [];
    for (const v of todo) {
      const label = `${v.report.code} v${v.version}`;
      try {
        const outcome = await grids.ensureBuilt(v.id);
        if (outcome === 'built') built += 1;
        console.log(`  ${outcome === 'built' ? 'built  ' : 'current'}  ${label}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push(`${label}: ${message}`);
        console.log(`  FAILED   ${label} — ${message}`);
      }
    }
    console.log(`Done: ${built} built, ${failed.length} failed, ${stale.length - todo.length} left.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
