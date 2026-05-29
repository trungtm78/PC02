/**
 * v0.47 PR1 T2 — Audit petition.detailContent + summary null rates + Case/Incident
 * TĐC backfill scope (read-only).
 *
 * Purpose: drive fail-closed validation decision in PR2 (PetitionsService.exportDocument).
 * If detailContent OR summary is populated for >= 95% of petitions, fail-closed is safe.
 * If both are null on > 5%, plan must add backfill step before enforcing.
 *
 * Also counts Case/Incident with status TAM_DINH_CHI — these rows will need backfill
 * of tdcStatuteExpiry/tdcKhacPhucLyDoBienPhap/tdcKhacPhucBienBan once PR1 T3 migration adds them.
 *
 * Usage:
 *   npx tsx backend/scripts/audit-petition-fields.ts          # human-readable to stdout
 *   npx tsx backend/scripts/audit-petition-fields.ts --json   # JSON to stdout for cron/Prom
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });
const JSON_MODE = process.argv.includes('--json');

function log(...args: unknown[]) {
  if (!JSON_MODE) console.log(...args);
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.00%';
  return ((part / total) * 100).toFixed(2) + '%';
}

async function main() {
  log('v0.47 PR1 T2 — Petition / Case / Incident audit (read-only)');

  // Q1: Petition detailContent + summary population
  const petitionTotal = await prisma.petition.count({ where: { deletedAt: null } });
  const bothNull = await prisma.petition.count({
    where: { deletedAt: null, detailContent: null, summary: null },
  });
  const detailNull = await prisma.petition.count({
    where: { deletedAt: null, detailContent: null },
  });
  const summaryNull = await prisma.petition.count({
    where: { deletedAt: null, summary: null },
  });

  log(`\nQ1: Petition content population (non-deleted)`);
  log(`  Total petitions:                    ${petitionTotal}`);
  log(`  detailContent IS NULL:              ${detailNull}  (${pct(detailNull, petitionTotal)})`);
  log(`  summary IS NULL:                    ${summaryNull}  (${pct(summaryNull, petitionTotal)})`);
  log(`  BOTH detailContent + summary NULL:  ${bothNull}  (${pct(bothNull, petitionTotal)})`);
  log(`  → Fail-closed safe if BOTH-null < 5%: ${(bothNull / Math.max(petitionTotal, 1)) < 0.05 ? 'YES' : 'NO — need backfill'}`);

  // Q2: Case TAM_DINH_CHI count (TĐC backfill scope)
  const caseTotal = await prisma.case.count({ where: { deletedAt: null } });
  const caseTDC = await prisma.case.count({
    where: { deletedAt: null, status: 'TAM_DINH_CHI' as any },
  });
  log(`\nQ2: Case status TAM_DINH_CHI (backfill scope for tdcStatuteExpiry/khacPhuc fields)`);
  log(`  Total cases:        ${caseTotal}`);
  log(`  TAM_DINH_CHI cases: ${caseTDC}  (${pct(caseTDC, caseTotal)})`);

  // Q3: Incident TAM_DINH_CHI count
  const incidentTotal = await prisma.incident.count({ where: { deletedAt: null } });
  const incidentTDC = await prisma.incident.count({
    where: { deletedAt: null, status: 'TAM_DINH_CHI' as any },
  });
  log(`\nQ3: Incident status TAM_DINH_CHI`);
  log(`  Total incidents:        ${incidentTotal}`);
  log(`  TAM_DINH_CHI incidents: ${incidentTDC}  (${pct(incidentTDC, incidentTotal)})`);

  if (JSON_MODE) {
    const summary = {
      ts: new Date().toISOString(),
      script: 'audit-petition-fields',
      petition: {
        total: petitionTotal,
        detailContent_null: detailNull,
        summary_null: summaryNull,
        both_null: bothNull,
        both_null_pct: petitionTotal === 0 ? 0 : bothNull / petitionTotal,
        fail_closed_safe: bothNull / Math.max(petitionTotal, 1) < 0.05,
      },
      case: { total: caseTotal, tam_dinh_chi: caseTDC },
      incident: { total: incidentTotal, tam_dinh_chi: incidentTDC },
    };
    console.log(JSON.stringify(summary, null, 2));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('audit-petition-fields failed:', e);
  process.exit(1);
});
