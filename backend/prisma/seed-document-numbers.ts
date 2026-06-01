/**
 * Seed DocumentNumber templates for all document types.
 *
 * Idempotent: skips template creation if an active template for the documentType
 * already exists. Counter currentValue is only initialised (never decreased) —
 * existing counters managed by the engine are never touched.
 *
 * Run: npx ts-node prisma/seed-document-numbers.ts
 * Or imported by deploy pipeline as seedDocumentNumbers(prisma).
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const YEAR = new Date().getUTCFullYear();

interface TemplateSpec {
  name: string;
  documentType: string;
  prefix: string;
  separator: string;
  inputMode: string;
  resetPeriod: string;
  padding: number;
  yearPattern: string; // e.g. "YYYY"
}

const TEMPLATES: TemplateSpec[] = [
  {
    name: 'Mã vụ việc',
    documentType: 'INCIDENT',
    prefix: 'VV',
    separator: '-',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 5,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số tiếp nhận đơn thư',
    documentType: 'PETITION',
    prefix: 'DT',
    separator: '-',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 5,
    yearPattern: 'YYYY',
  },
  {
    name: 'Mã hồ sơ',
    documentType: 'CASE',
    prefix: 'HS',
    separator: '-',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 3,
    yearPattern: 'YYYY',
  },
  {
    name: 'Mã đề xuất',
    documentType: 'PROPOSAL',
    prefix: 'DX',
    separator: '-',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 5,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số ủy thác',
    documentType: 'DELEGATION',
    prefix: 'UT',
    separator: '/',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 4,
    yearPattern: 'YYYY',
  },
  {
    name: 'Mã vật chứng',
    documentType: 'EVIDENCE',
    prefix: 'VC',
    separator: '-',
    inputMode: 'AUTO_WITH_OVERRIDE',
    resetPeriod: 'YEARLY',
    padding: 3,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số ủy thác điều tra',
    documentType: 'UTDT',
    prefix: 'UTDT',
    separator: '-',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 5,
    yearPattern: 'YYYY',
  },
  // v0.47 PR1 T4 — 4 series for Document Template Engine v1.0.
  // Format example: "5931/ĐX-PC02-Đ1" (counter / prefix-org-team).
  // Team code is HARDCODED "Đ1" for now — PR2 will swap to a FORMULA segment once
  // source-resolver gains lookup:teams.code (resolves via user → UserTeam → Team).
  // The 6 docx render variants share 4 numbering series:
  //   PHIEU_DE_XUAT       → ĐX   (Phiếu đề xuất)
  //   PHIEU_CHUYEN        → PC   (Phiếu chuyển nguồn tin + Phiếu chuyển đơn)
  //   THONG_BAO           → TB   (Thông báo chuyển đơn + Thông báo trả lại đơn)
  //   HUONG_DAN           → HD   (Thông báo hướng dẫn khởi kiện)
  {
    name: 'Số Phiếu đề xuất',
    documentType: 'PHIEU_DE_XUAT',
    prefix: 'ĐX-PC02-Đ1',
    separator: '/',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 4,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số Phiếu chuyển',
    documentType: 'PHIEU_CHUYEN',
    prefix: 'PC-PC02-Đ1',
    separator: '/',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 4,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số Thông báo',
    documentType: 'THONG_BAO',
    prefix: 'TB-PC02-Đ1',
    separator: '/',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 4,
    yearPattern: 'YYYY',
  },
  {
    name: 'Số Thông báo Hướng dẫn',
    documentType: 'HUONG_DAN',
    prefix: 'HD-PC02-Đ1',
    separator: '/',
    inputMode: 'AUTO',
    resetPeriod: 'YEARLY',
    padding: 4,
    yearPattern: 'YYYY',
  },
];

// v0.47 PR1 T4 — series that do NOT participate in existing counter backfill
// (no matching existing column on Petition/Case/Incident). Skipped by
// getMaxSeqForYear; counter starts at 0 (next render → 1).
const NEW_V047_SERIES = new Set([
  'PHIEU_DE_XUAT',
  'PHIEU_CHUYEN',
  'THONG_BAO',
  'HUONG_DAN',
]);

function buildSegments(spec: TemplateSpec) {
  // v0.47 PR1 T4 — new series use [COUNTER, LITERAL prefix] order with no
  // explicit year segment (year is implicit via YEARLY reset). Produces
  // "5931/ĐX-PC02-Đ1" instead of the legacy "DT-2026-00001" shape.
  if (NEW_V047_SERIES.has(spec.documentType)) {
    return [
      { type: 'COUNTER' },
      { type: 'LITERAL', value: spec.prefix },
    ];
  }
  return [
    { type: 'LITERAL', value: spec.prefix },
    { type: 'FORMULA', fn: 'FORMAT', source: 'NOW', pattern: spec.yearPattern },
    { type: 'COUNTER' },
  ];
}

function buildCounterConfig(spec: TemplateSpec) {
  return {
    resetPeriod: spec.resetPeriod,
    minValue: 1,
    maxValue: 99999,
    padding: spec.padding,
  };
}

async function getMaxSeqForYear(prisma: PrismaClient, documentType: string, year: number): Promise<number> {
  // v0.47 PR1 T4 — new series have no existing column to backfill from;
  // start counter at 0 so first render yields ...001.
  if (NEW_V047_SERIES.has(documentType)) return 0;

  const prefix = `${getPrefix(documentType)}-${year}-`;

  try {
    if (documentType === 'INCIDENT') {
      const rows = await prisma.incident.findMany({
        where: { code: { startsWith: prefix } },
        select: { code: true },
      });
      return extractMax(rows.map((r: { code: string }) => r.code));
    }

    if (documentType === 'PETITION') {
      const rows = await prisma.petition.findMany({
        where: { stt: { startsWith: prefix } },
        select: { stt: true },
      });
      return extractMax(rows.map((r: { stt: string }) => r.stt));
    }

    if (documentType === 'CASE') {
      // caseCode was backfilled by migration 20260525000001
      const casePrefix = `HS-${year}-`;
      const rows = await (prisma as any).case.findMany({
        where: { caseCode: { startsWith: casePrefix } },
        select: { caseCode: true },
      });
      return extractMax(rows.filter((r: { caseCode: string | null }) => r.caseCode).map((r: { caseCode: string }) => r.caseCode));
    }
  } catch {
    // Table may be empty or field missing — start from 0
  }

  return 0;
}

function getPrefix(documentType: string): string {
  const map: Record<string, string> = {
    INCIDENT: 'VV',
    PETITION: 'DT',
    CASE: 'HS',
    PROPOSAL: 'DX',
    DELEGATION: 'UT',
    EVIDENCE: 'VC',
    UTDT: 'UTDT',
  };
  return map[documentType] ?? '';
}

function extractMax(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const parts = code.split(/[-/]/);
    const seq = parseInt(parts[parts.length - 1] ?? '0', 10);
    if (!isNaN(seq) && seq > max) max = seq;
  }
  return max;
}

export async function seedDocumentNumbers(prisma: PrismaClient): Promise<number> {
  let created = 0;

  // Find any SUPER_ADMIN or ADMIN user to use as createdById
  const admin = await (prisma as any).user.findFirst({
    where: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
    select: { id: true },
  });

  if (!admin) {
    console.error('✖ No ADMIN user found — document number templates cannot be seeded without an admin user');
    process.exit(1);
  }

  for (const spec of TEMPLATES) {
    // Skip if active template already exists for this documentType
    const existing = await (prisma as any).documentNumberTemplate.findFirst({
      where: { documentType: spec.documentType, isActive: true },
      select: { id: true },
    });

    let templateId: string;

    if (existing) {
      templateId = existing.id;
      // v0.47 PR1 T4 — force-refresh segments + counterConfig for new series so
      // that PR2's FORMULA-segment rewrite propagates to existing rows (skip
      // behavior would lock in the PR1 hardcoded "Đ1" suffix forever).
      // Legacy templates keep the skip-on-exists behavior to preserve admin edits.
      if (NEW_V047_SERIES.has(spec.documentType)) {
        await (prisma as any).documentNumberTemplate.update({
          where: { id: existing.id },
          data: {
            segments: buildSegments(spec),
            counterConfig: buildCounterConfig(spec),
            separator: spec.separator,
            inputMode: spec.inputMode,
          },
        });
        console.log(`  ↻ Refreshed v0.47 series "${spec.name}" (${spec.documentType})`);
      } else {
        console.log(`  → Template "${spec.name}" (${spec.documentType}) already exists, skipping create`);
      }
    } else {
      const tpl = await (prisma as any).documentNumberTemplate.create({
        data: {
          name: spec.name,
          documentType: spec.documentType,
          isActive: true,
          separator: spec.separator,
          inputMode: spec.inputMode,
          segments: buildSegments(spec),
          counterConfig: buildCounterConfig(spec),
          createdById: admin.id,
        },
        select: { id: true },
      });
      templateId = tpl.id;
      created++;
      console.log(`  ✔ Created template "${spec.name}" (${spec.documentType})`);
    }

    // Initialise counter for current year — only if no counter row exists yet
    const periodKey = String(YEAR);
    const existingCounter = await (prisma as any).documentNumberCounter.findUnique({
      where: { templateId_periodKey: { templateId, periodKey } },
      select: { id: true, currentValue: true },
    });

    if (!existingCounter) {
      const maxSeq = await getMaxSeqForYear(prisma, spec.documentType, YEAR);
      await (prisma as any).documentNumberCounter.create({
        data: {
          templateId,
          periodKey,
          currentValue: maxSeq,
        },
      });
      console.log(
        `  ✔ Initialised counter for ${spec.documentType} / ${periodKey} → currentValue = ${maxSeq}`,
      );
    } else {
      console.log(
        `  → Counter for ${spec.documentType} / ${periodKey} already exists (value=${existingCounter.currentValue}), skipping`,
      );
    }
  }

  return created;
}

// Test-only re-exports (kept at module bottom to avoid disturbing the
// public CLI surface). Used by seed-document-numbers.spec.ts to validate
// the static config shape without spinning up a DB.
export const TEMPLATES_FOR_TEST = TEMPLATES;
export const buildSegmentsForTest = buildSegments;

// Standalone CLI entry point
if (require.main === module) {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    console.error('✖ DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  seedDocumentNumbers(prisma)
    .then((count) => {
      console.log(`\n✔ Document number seed complete: ${count} new templates created`);
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
