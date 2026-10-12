/**
 * READ-ONLY audit of every published or retired report version: does the list
 * of input cells stored for it still agree with the uploaded template file?
 *
 * Before OV3 a publish request carried the field list, the layout and the
 * formulas from the browser and the server stored them as sent. This re-reads
 * each stored file and applies the same reconciliation the server now runs at
 * publish time, so any version that slipped through (a locked or formula cell
 * made editable, an input the file declares but the version lacks) is named
 * before the entry grid is switched on for it.
 *
 * Writes nothing. Exit code 1 if any version has a problem.
 *
 * Usage (from backend/):
 *   npx ts-node --transpile-only scripts/audit-dr-versions.ts
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { parseTemplate } from '../src/dynamic-reports/template/parser';
import { reconcileFieldsWithWorkbook } from '../src/dynamic-reports/config/publish-reconcile';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  let bad = 0;
  try {
    const versions = await prisma.dynReportVersion.findMany({
      where: { status: { in: ['PUBLISHED', 'RETIRED'] } },
      select: {
        id: true,
        version: true,
        fileName: true,
        selectedSheets: true,
        report: { select: { code: true } },
        layout: true,
        fields: { select: { sheetKey: true, address: true, fieldKey: true, type: true, aggregate: true, source: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`${versions.length} published/retired versions to audit.`);

    for (const v of versions) {
      const label = `${v.report.code} v${v.version} (${v.fileName})`;
      const row = await prisma.dynReportVersion.findUnique({
        where: { id: v.id },
        select: { fileBytes: true },
      });
      const sheets = Array.isArray(v.selectedSheets) ? (v.selectedSheets as string[]) : [];
      try {
        const parsed = await parseTemplate(Buffer.from(row!.fileBytes), sheets);
        const { problems } = reconcileFieldsWithWorkbook(parsed, sheets, v.fields);
        const errors = parsed.issues.filter((i) => i.severity === 'ERROR');

        const stored = (v.layout as { formulas?: Array<{ sheetKey: string; address: string; expression: string }> } | null)?.formulas ?? [];
        const key = (f: { sheetKey: string; address: string }) => `${f.sheetKey}!${f.address}`;
        const fromFile = new Map(parsed.formulas.map((f) => [key(f), f.expression]));
        const fromStore = new Map(stored.map((f) => [key(f), f.expression]));
        const formulaDrift: string[] = [];
        for (const [k, expr] of fromFile) {
          if (!fromStore.has(k)) formulaDrift.push(`${k}: có trong file, không có trong bản lưu`);
          else if (fromStore.get(k) !== expr) formulaDrift.push(`${k}: công thức lưu "${fromStore.get(k)}" ≠ file "${expr}"`);
        }
        for (const k of fromStore.keys()) {
          if (!fromFile.has(k)) formulaDrift.push(`${k}: có trong bản lưu, không có trong file`);
        }

        const all = [
          ...problems,
          ...errors.map((e) => `${e.sheetKey}${e.address ? '!' + e.address : ''}: ${e.message} (lỗi phân tích)`),
          ...formulaDrift.slice(0, 8).map((d) => `công thức: ${d}`),
        ];
        if (all.length === 0) {
          console.log(`  OK       ${label}`);
        } else {
          bad += 1;
          console.log(`  PROBLEM  ${label}`);
          for (const p of all) console.log(`             - ${p}`);
        }
      } catch (err) {
        bad += 1;
        console.log(`  UNREADABLE ${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(bad === 0 ? 'All versions agree with their files.' : `${bad} version(s) need attention.`);
    if (bad > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
