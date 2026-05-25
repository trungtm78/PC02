/**
 * Seed DocumentNumber templates for all 6 document types.
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
];

function buildSegments(spec: TemplateSpec) {
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
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
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
      console.log(`  → Template "${spec.name}" (${spec.documentType}) already exists, skipping create`);
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
