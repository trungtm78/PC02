/**
 * v0.37.1 PR-DATA — Audit case provenance state (read-only)
 * v0.37.2 PROV-003 — Added --json-only mode for cron consumption.
 *
 * Runs 3 queries (per plan v2.4):
 *   Q1: Cases with metadata.caseType populated (legacy vestigial field)
 *   Q2: Petitions with linkedCaseId + suspicious senderName (phantom from old auto-create)
 *   Q3: 1-1 mapping verification (Petition.linkedCaseId vs Case.linkedPetitionId — drift detect)
 *
 * Usage:
 *   npx tsx backend/scripts/audit-case-provenance.ts          # full mode (CSV + audit log)
 *   npx tsx backend/scripts/audit-case-provenance.ts --json   # JSON to stdout for cron/Prometheus
 *
 * Output: CSV to /var/lib/pc02/audit/ (production) or /tmp (dev), mode 0600.
 * Logs execution to audit_logs.
 *
 * Schedule (cron, weekly Monday 03:00):
 *   0 3 * * 1 cd /home/pc02/current/backend && npx tsx scripts/audit-case-provenance.ts --json > /var/lib/pc02/audit/weekly-drift.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const JSON_MODE = process.argv.includes('--json');

function log(...args: unknown[]) {
  if (!JSON_MODE) console.log(...args);
}

async function main() {
  log('PR-DATA audit starting (read-only)');

  // Q1: Cases with metadata.caseType
  const q1 = await prisma.$queryRaw<Array<{ id: string; metadata: unknown }>>`
    SELECT id, metadata FROM "cases"
    WHERE metadata IS NOT NULL AND metadata ? 'caseType'
    LIMIT 1000
  `;
  log(`Q1: Cases with metadata.caseType: ${q1.length}`);

  // Q2: Petitions with linkedCaseId + suspicious senderName (phantom detection heuristic).
  // True phantoms would need cross-ref with audit_logs PETITION_AUTO_CREATED — defer to follow-up.
  const q2 = await prisma.petition.findMany({
    where: {
      linkedCaseId: { not: null },
      OR: [
        { senderName: 'Chưa xác định' },
        { senderName: '' },
      ],
    },
    select: { id: true, stt: true, senderName: true, linkedCaseId: true, createdAt: true },
    take: 1000,
  });
  log(`Q2: Petitions with suspicious senderName + linkedCaseId: ${q2.length}`);

  // Q3: Mirror link drift — Petition.linkedCaseId vs Case.linkedPetitionId mismatch
  const q3 = await prisma.$queryRaw<Array<{ petition_id: string; case_id: string }>>`
    SELECT p.id AS petition_id, c.id AS case_id
    FROM "petitions" p
    INNER JOIN "cases" c ON p."linkedCaseId" = c.id
    WHERE c."linkedPetitionId" IS NULL OR c."linkedPetitionId" != p.id
    LIMIT 1000
  `;
  log(`Q3: Mirror link drift (Petition→Case but Case missing reverse link): ${q3.length}`);

  // PROV-003 cron mode — JSON to stdout for Prometheus/alert pipelines
  if (JSON_MODE) {
    const summary = {
      ts: new Date().toISOString(),
      q1_metadata_caseType: q1.length,
      q2_phantom_petitions: q2.length,
      q3_mirror_drift: q3.length,
      total_findings: q1.length + q2.length + q3.length,
    };
    console.log(JSON.stringify(summary));
    await prisma.$disconnect();
    return;
  }

  // Write CSV report
  const outDir = process.env.PC02_AUDIT_DIR || '/tmp';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `case-provenance-audit-${ts}.csv`);
  const csv = [
    'query,case_or_petition_id,detail',
    ...q1.map((r) => `Q1_caseType,${r.id},${JSON.stringify(r.metadata).replace(/[",\n]/g, ' ').slice(0, 200)}`),
    ...q2.map((r) => `Q2_phantom,${r.id},stt=${r.stt} sender="${r.senderName}" linkedCase=${r.linkedCaseId}`),
    ...q3.map((r) => `Q3_drift,${r.petition_id},case=${r.case_id}`),
  ].join('\n');
  fs.writeFileSync(outFile, csv, { mode: 0o600 });
  log(`\nReport: ${outFile} (mode 0600)`);

  // Log to audit_logs for compliance trail (best-effort — table may not have AUDIT_SCRIPT_RUN action)
  try {
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, "userId", action, subject, metadata, "ipAddress", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        'system',
        'AUDIT_SCRIPT_RUN',
        'Case',
        ${JSON.stringify({ script: 'audit-case-provenance', q1: q1.length, q2: q2.length, q3: q3.length, outFile })}::jsonb,
        '127.0.0.1',
        NOW()
      )
    `;
  } catch {
    console.log('(audit_logs entry skipped — table action enum may not include AUDIT_SCRIPT_RUN)');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('PR-DATA audit failed:', e);
  process.exit(1);
});
