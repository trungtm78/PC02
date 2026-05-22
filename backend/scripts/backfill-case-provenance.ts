/**
 * v0.37.1 PR-DATA — Backfill case provenance after Deploy-1 expand migration
 *
 * Runs the precedence rules from plan v2.4 to populate caseProvenance + linkedX
 * for existing Case rows that have NULL/default values after PR-PROV-1 migration.
 *
 * Precedence (per plan v2.4 + eng review consensus):
 *   1. Petition.linkedCaseId = Case.id     → FROM_PETITION + linkedPetitionId
 *   2. Incident.linkedCaseId = Case.id     → FROM_INCIDENT + linkedIncidentId
 *   3. Case.metadata.petitionType (no link) → OTHER_LEGAL_SOURCE + flag INCONSISTENT (audit)
 *   4. Else                                 → OTHER_LEGAL_SOURCE
 *
 * Writes to case_provenance_backfill_audit for traceability.
 *
 * Usage:
 *   npx tsx backend/scripts/backfill-case-provenance.ts [--dry-run] [--batch-size=1000]
 *
 * Idempotent: skip Cases that already have a non-default caseProvenance set.
 * Output: /var/lib/pc02/audit/case-provenance-backfill-<timestamp>.csv (production only)
 *         stdout summary otherwise
 */

import { PrismaClient, CaseProvenance } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BackfillResult {
  caseId: string;
  detectedSource: string;
  inconsistency: string | null;
  linkedPetitionId?: string | null;
  linkedIncidentId?: string | null;
}

const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith('--batch-size='))?.split('=')[1] ?? '1000',
  10,
);
const DRY_RUN = process.argv.includes('--dry-run');

async function classifyCase(caseRow: {
  id: string;
  metadata: unknown;
}): Promise<{
  provenance: CaseProvenance;
  linkedPetitionId: string | null;
  linkedIncidentId: string | null;
  inconsistency: string | null;
}> {
  // Priority 1: Petition.linkedCaseId
  const linkedPetition = await prisma.petition.findFirst({
    where: { linkedCaseId: caseRow.id, deletedAt: null },
    select: { id: true },
  });
  if (linkedPetition) {
    return {
      provenance: CaseProvenance.FROM_PETITION,
      linkedPetitionId: linkedPetition.id,
      linkedIncidentId: null,
      inconsistency: null,
    };
  }

  // Priority 2: Incident.linkedCaseId
  const linkedIncident = await prisma.incident.findFirst({
    where: { linkedCaseId: caseRow.id, deletedAt: null },
    select: { id: true },
  });
  if (linkedIncident) {
    return {
      provenance: CaseProvenance.FROM_INCIDENT,
      linkedPetitionId: null,
      linkedIncidentId: linkedIncident.id,
      inconsistency: null,
    };
  }

  // Priority 3: metadata.petitionType present but no linked Petition → orphan
  const metadata = caseRow.metadata as Record<string, unknown> | null;
  const legacyPetitionType = metadata?.petitionType as string | undefined;
  if (legacyPetitionType) {
    return {
      provenance: CaseProvenance.OTHER_LEGAL_SOURCE,
      linkedPetitionId: null,
      linkedIncidentId: null,
      inconsistency: `metadata.petitionType=${legacyPetitionType} but no linked Petition row — phantom auto-create artifact`,
    };
  }

  // Priority 4: default
  return {
    provenance: CaseProvenance.OTHER_LEGAL_SOURCE,
    linkedPetitionId: null,
    linkedIncidentId: null,
    inconsistency: null,
  };
}

async function main() {
  console.log(`PR-DATA backfill starting (dry-run=${DRY_RUN}, batch-size=${BATCH_SIZE})`);

  let processed = 0;
  let lastId: string | undefined = undefined;
  const results: BackfillResult[] = [];

  // Stream by id ASC, in batches, to support resume on failure.
  while (true) {
    // Skip Cases already audited (idempotent). Audit table is raw SQL — not a Prisma model.
    const auditedIds = await prisma.$queryRaw<Array<{ case_id: string }>>`
      SELECT case_id FROM case_provenance_backfill_audit
    `;
    const auditedSet = new Set(auditedIds.map((a) => a.case_id));

    const batch = await prisma.case.findMany({
      where: {
        ...(lastId ? { id: { gt: lastId } } : {}),
        ...(auditedSet.size > 0 ? { NOT: { id: { in: Array.from(auditedSet) } } } : {}),
      },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: { id: true, metadata: true },
    });

    if (batch.length === 0) break;

    for (const c of batch) {
      const { provenance, linkedPetitionId, linkedIncidentId, inconsistency } = await classifyCase(c);

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          await tx.case.update({
            where: { id: c.id },
            data: {
              caseProvenance: provenance,
              linkedPetitionId,
              linkedIncidentId,
            },
          });
          // Audit table managed via raw SQL (not a Prisma model — see migration 20260522230000)
          await tx.$executeRaw`
            INSERT INTO case_provenance_backfill_audit
              (case_id, detected_source, inconsistency, metadata_snapshot)
            VALUES (
              ${c.id},
              ${provenance}::text,
              ${inconsistency},
              ${c.metadata ?? null}::jsonb
            )
            ON CONFLICT (case_id) DO NOTHING
          `;
        });
      }

      results.push({
        caseId: c.id,
        detectedSource: provenance,
        inconsistency,
        linkedPetitionId,
        linkedIncidentId,
      });
      processed += 1;
    }

    lastId = batch[batch.length - 1].id;
    console.log(`  processed: ${processed}`);
  }

  // Summary
  const byProvenance = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.detectedSource] = (acc[r.detectedSource] ?? 0) + 1;
    return acc;
  }, {});
  const inconsistencyCount = results.filter((r) => r.inconsistency).length;

  console.log('\n=== BACKFILL SUMMARY ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLIED'}`);
  console.log(`Inconsistencies flagged: ${inconsistencyCount}`);
  console.log('By detected provenance:');
  for (const [p, n] of Object.entries(byProvenance)) {
    console.log(`  ${p}: ${n}`);
  }

  // Write CSV report (production: /var/lib/pc02/audit/, dev: /tmp)
  const outDir = process.env.PC02_AUDIT_DIR || '/tmp';
  if (fs.existsSync(outDir) || outDir.startsWith('/tmp')) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, `case-provenance-backfill-${ts}.csv`);
    const csv = [
      'case_id,detected_source,linked_petition_id,linked_incident_id,inconsistency',
      ...results.map((r) =>
        [
          r.caseId,
          r.detectedSource,
          r.linkedPetitionId ?? '',
          r.linkedIncidentId ?? '',
          (r.inconsistency ?? '').replace(/[",\n]/g, ' '),
        ].join(','),
      ),
    ].join('\n');
    fs.writeFileSync(outFile, csv, { mode: 0o600 });
    console.log(`\nReport written: ${outFile} (mode 0600)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('PR-DATA backfill failed:', e);
  process.exit(1);
});
