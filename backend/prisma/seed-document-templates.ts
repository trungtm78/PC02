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
import * as fs from 'fs';
import * as path from 'path';
import { detectDocxVariables } from '../src/document-templates/docx-variables.util';
import { isAutoPlaceholder } from '../src/document-templates/entity-placeholders';
import { DOCUMENT_TYPES } from '../src/document-templates/docx-loader.service';
import {
  buildPetitionSeedVariables,
  PETITION_SEED_META,
} from '../src/document-templates/petition-seed';
import { DOC_TYPE_TO_SERIES } from '../src/petitions/document-export.service';
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
      // PR2: BACKFILL cờ `required` mặc định CHỈ KHI mẫu CHƯA từng cấu hình required (mọi biến
      // required falsy). Nếu admin/API đã set required (có ≥1 biến required:true) → GIỮ NGUYÊN,
      // không ghi đè (tôn trọng contract "không ghi đè bản admin đã sửa" — codex PR2).
      const curVars = (existing.variables as Array<{ name: string; required?: boolean }>) ?? [];
      const alreadyConfigured = curVars.some((v) => v.required === true);
      if (!alreadyConfigured) {
        const req = new Set(REQUIRED_VARS[spec.code] ?? []);
        const vars = curVars.map((v) => ({ ...v, required: req.has(v.name) }));
        await (prisma as any).documentTemplate.update({ where: { id: existing.id }, data: { variables: vars } });
        console.log(`  ↻ ${spec.entityType}/${spec.code} backfill required (${[...req].length} biến).`);
      } else {
        console.log(`  → ${spec.entityType}/${spec.code} đã có cấu hình required (admin) — giữ nguyên.`);
      }
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

/** Thư mục 7 file .docx tĩnh Đơn thư (nguồn cutover sang hệ động). */
function resolvePetitionDocxDir(): string {
  // prisma/ → backend/templates/docx (dev ts-node) | dist/templates/docx (prod, nếu copy)
  const src = path.resolve(__dirname, '..', 'templates', 'docx');
  if (fs.existsSync(src)) return src;
  return path.resolve(__dirname, '..', '..', 'templates', 'docx');
}

/**
 * Seed 7 mẫu Đơn thư tĩnh (templates/docx/*.docx) vào hệ template ĐỘNG (entityType=DON_THU).
 * - `code` = DocumentType (BIEN_NHAN…) để cấp số/render-log tương thích engine cũ.
 * - `needsNumber=true` + `numberSeriesId` theo DOC_TYPE_TO_SERIES (series dùng chung PHIEU_CHUYEN/THONG_BAO).
 * - GATE: buildPetitionSeedVariables throw nếu placeholder ngoài catalog DON_THU.
 * - Idempotent create-if-absent (KHÔNG ghi đè bản admin đã sửa); backfill required nếu chưa cấu hình.
 */
export async function seedPetitionTemplates(
  prisma: PrismaClient,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const admin = await (prisma as any).user.findFirst({
    where: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
    select: { id: true },
  });
  if (!admin) {
    console.warn('⚠ Không tìm thấy ADMIN — bỏ qua seed mẫu Đơn thư (non-fatal).');
    return { created, skipped };
  }

  const dir = resolvePetitionDocxDir();
  for (const docType of DOCUMENT_TYPES) {
    const file = path.join(dir, `${docType}.docx`);
    if (!fs.existsSync(file)) {
      console.warn(`⚠ Thiếu file ${file} — bỏ qua ${docType}.`);
      continue;
    }
    const buffer = fs.readFileSync(file);
    const meta = PETITION_SEED_META[docType];
    const numberSeriesId = DOC_TYPE_TO_SERIES[docType];

    const existing = await (prisma as any).documentTemplate.findFirst({
      where: { entityType: 'DON_THU', code: docType, deletedAt: null },
      select: { id: true, variables: true },
    });
    if (existing) {
      skipped++;
      const curVars = (existing.variables as Array<{ required?: boolean }>) ?? [];
      const alreadyConfigured = curVars.some((v) => v.required === true);
      if (!alreadyConfigured) {
        const vars = buildPetitionSeedVariables(docType, buffer);
        await (prisma as any).documentTemplate.update({
          where: { id: existing.id },
          data: { variables: vars },
        });
        console.log(`  ↻ DON_THU/${docType} backfill required.`);
      } else {
        console.log(`  → DON_THU/${docType} đã cấu hình (admin) — giữ nguyên.`);
      }
      continue;
    }

    const variables = buildPetitionSeedVariables(docType, buffer); // GATE bên trong
    const fileSha = createHash('sha256').update(buffer).digest('hex');
    await (prisma as any).documentTemplate.create({
      data: {
        code: docType,
        name: meta.name,
        entityType: 'DON_THU',
        category: meta.category,
        fileBytes: buffer,
        fileSha,
        fileName: `${docType}.docx`,
        variables,
        format: 'DOCX',
        delimStart: '{',
        delimEnd: '}',
        needsNumber: true,
        numberSeriesId,
        status: 'active',
        sortOrder: meta.sortOrder,
        createdById: admin.id,
      },
    });
    created++;
    console.log(`  ✔ Tạo mẫu Đơn thư ${docType} — "${meta.name}" (${variables.length} biến, series ${numberSeriesId}).`);
  }

  console.log(`\n✔ Seed mẫu Đơn thư: ${created} tạo mới, ${skipped} đã có.`);
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
  (async () => {
    const a = await seedDocumentTemplates(prisma);
    const b = await seedPetitionTemplates(prisma);
    console.log(`\nDone: vu-an/vu-viec ${JSON.stringify(a)} | don-thu ${JSON.stringify(b)}`);
  })()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
