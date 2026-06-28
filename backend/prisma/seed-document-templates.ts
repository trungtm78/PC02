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

/**
 * PR2 — biến BẮT BUỘC mặc định per mẫu (readiness báo "Thiếu" + bổ sung khi in). Admin tinh chỉnh
 * sau qua update.requiredVariables. Chọn trường cốt lõi để chứng từ có nghĩa (auto → flag khi hồ sơ
 * thiếu; manual → nhập tại popup khi in).
 */
const REQUIRED_VARS: Record<string, string[]> = {
  QD_KHOI_TO_VU_AN: ['tenVuAn', 'toiDanh', 'noiXayRa'],
  QD_KHOI_TO_BI_CAN: ['hoTenBiCan', 'namSinh', 'toiDanh', 'dieuLuat'],
  KET_LUAN_DIEU_TRA: ['soKLDT', 'tenVuAn', 'toiDanh', 'hoTenBiCan', 'dieuLuat'],
  QD_TAM_DINH_CHI_DT: ['tenVuAn', 'lyDo'],
  BB_HOI_CUNG_BI_CAN: ['hoTenBiCan', 'gioBatDau', 'diaDiem'],
  QD_PHAN_CONG_GIAI_QUYET: ['tenVuViec', 'nguonTin', 'dieuTraVien', 'nguoiQuyetDinh'],
  QD_KHOI_TO_TU_NGUON_TIN: ['tenVuViec', 'toiDanh', 'dieuLuat'],
  QD_KHONG_KHOI_TO: ['tenVuViec', 'lyDo', 'nguoiQuyetDinh'],
  TB_KET_QUA_GIAI_QUYET: ['nguoiNhan', 'tenVuViec', 'ketQua'],
  QD_TAM_DINH_CHI_GQ: ['tenVuViec', 'lyDo'],
};

function buildVariables(buffer: Buffer, entityType: string, requiredNames: string[] = []) {
  const req = new Set(requiredNames);
  return detectDocxVariables(buffer).map((name) => ({
    name,
    source: isAutoPlaceholder(entityType, name) ? 'auto' : 'manual',
    label: name,
    required: req.has(name),
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
      select: { id: true, variables: true },
    });
    if (existing) {
      skipped++;
      // PR2: refresh CỜ `required` trên variables hiện có (không đụng file/nội dung admin đã sửa).
      // An toàn vì admin-UI sửa required chưa có → không mất admin-edit. (Bỏ khi admin-UI ra.)
      const req = new Set(REQUIRED_VARS[spec.code] ?? []);
      const vars = ((existing.variables as Array<{ name: string }>) ?? []).map((v) => ({ ...v, required: req.has(v.name) }));
      await (prisma as any).documentTemplate.update({ where: { id: existing.id }, data: { variables: vars } });
      console.log(`  ↻ ${spec.entityType}/${spec.code} refresh required (${[...req].length} biến bắt buộc).`);
      continue;
    }

    const buffer = await buildTemplateDocx(spec.body);
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    const variables = buildVariables(buffer, spec.entityType, REQUIRED_VARS[spec.code] ?? []);

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
