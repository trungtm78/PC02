/**
 * Seed bộ mẫu chứng từ chuẩn (VU_AN/VU_VIEC) vào bảng document_templates.
 *
 * - File .docx sinh bằng lib `docx` (registry.ts) → ingest BYTES vào DB (export đọc fileBytes,
 *   KHÔNG đọc file lúc runtime).
 * - Idempotent: chỉ create khi CHƯA có (entityType, code, deletedAt IS NULL) → KHÔNG ghi đè bản
 *   admin đã sửa. (Không so sánh sha drift vì lib `docx` nhúng timestamp → bytes khác mỗi build;
 *   an toàn không-ghi-đè do create-if-absent đảm bảo, không phụ thuộc sha.)
 * - `variables` Json sinh giống service (detectDocxVariables + isAutoPlaceholder).
 * - createdById = admin; KHÔNG có admin → cảnh báo + bỏ qua (NON-FATAL, template không cản boot).
 *
 * Run: npx ts-node prisma/seed-document-templates.ts
 * Hoặc import seedDocumentTemplates(prisma) trong deploy pipeline.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'crypto';
import { detectDocxVariables } from '../src/document-templates/docx-variables.util';
import { isAutoPlaceholder } from '../src/document-templates/entity-placeholders';
import { buildTemplateDocx } from './seed-assets/document-templates/docx-builder';
import { TEMPLATE_SPECS } from './seed-assets/document-templates/registry';

function buildVariables(buffer: Buffer, entityType: string) {
  return detectDocxVariables(buffer).map((name) => ({
    name,
    source: isAutoPlaceholder(entityType, name) ? 'auto' : 'manual',
    label: name,
  }));
}

export async function seedDocumentTemplates(prisma: PrismaClient): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const admin = await (prisma as any).user.findFirst({
    where: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
    select: { id: true },
  });
  if (!admin) {
    console.warn('⚠ Không tìm thấy user ADMIN/SUPER_ADMIN — bỏ qua seed mẫu chứng từ (non-fatal).');
    return { created, skipped };
  }

  for (const spec of TEMPLATE_SPECS) {
    const existing = await (prisma as any).documentTemplate.findFirst({
      where: { entityType: spec.entityType, code: spec.code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      console.log(`  → ${spec.entityType}/${spec.code} đã có, bỏ qua (không ghi đè).`);
      continue;
    }

    const buffer = await buildTemplateDocx(spec.body);
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    const variables = buildVariables(buffer, spec.entityType);

    await (prisma as any).documentTemplate.create({
      data: {
        code: spec.code,
        name: spec.name,
        entityType: spec.entityType,
        category: spec.category,
        fileBytes: buffer,
        fileSha,
        fileName: `${spec.code}.docx`,
        variables,
        needsNumber: false, // cấp số tự động → admin bật + chọn series sau (ngoài phạm vi seed).
        numberSeriesId: null,
        status: 'active',
        sortOrder: spec.sortOrder,
        createdById: admin.id,
      },
    });
    created++;
    console.log(`  ✔ Tạo mẫu ${spec.entityType}/${spec.code} — "${spec.name}" (${variables.length} biến).`);
  }

  console.log(`\n✔ Seed mẫu chứng từ: ${created} tạo mới, ${skipped} đã có.`);
  return { created, skipped };
}

// CLI entry
if (require.main === module) {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    console.error('✖ DATABASE_URL chưa được set');
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });
  seedDocumentTemplates(prisma)
    .then((r) => console.log(`\nDone: ${JSON.stringify(r)}`))
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
