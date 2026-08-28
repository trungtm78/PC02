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
import {
  buildPetitionSeedVariables,
  markRequiredByDocType,
  PETITION_SEED_META,
  PETITION_DOC_TYPES,
  DOC_TYPE_TO_SERIES,
} from '../src/document-templates/petition-seed';
import { buildTemplateDocx } from './seed-assets/document-templates/docx-builder';
import { TEMPLATE_SPECS } from './seed-assets/document-templates/registry';
import { seedLegacyTemplates } from './seed-legacy-templates';
import { timThuMucMau } from './duong-dan-mau';

/**
 * PR2 — biến BẮT BUỘC mặc định per mẫu (readiness báo "Thiếu" + bổ sung khi in). Admin tinh chỉnh
 * sau qua update.requiredVariables. Chọn trường cốt lõi để chứng từ có nghĩa (auto → flag khi hồ sơ
 * thiếu; manual → nhập tại popup khi in).
 */
/**
 * Chỉ đánh dấu BẮT BUỘC những trường hệ thống THẬT SỰ có dữ liệu.
 *
 * Luật sẵn sàng-in coi một biến bắt buộc còn rỗng là "chưa in được", nên mỗi trường bắt buộc
 * mà dữ liệu không bao giờ có là một mẫu bị khoá vĩnh viễn. Đo trên máy thật 28/08/2026:
 *
 *   `soKLDT`         0/3.673 vụ án   — bản gốc hệ cũ cũng 0
 *   `nguonTin`       0/4.848 vụ việc — bản gốc hệ cũ cũng 0
 *   `nguoiQuyetDinh` 0/4.848 vụ việc — bản gốc hệ cũ cũng 0
 *
 * Ba trường ấy bỏ khỏi danh sách bắt buộc; cán bộ vẫn điền được ở popup khi cần. Cùng lẽ ấy
 * với `gioBatDau`/`diaDiem` của biên bản hỏi cung: chỉ cán bộ mới biết, và không được vì thế
 * mà chặn in — hệ cũ vốn in cả khi trường trống.
 *
 * Những trường còn lại đều đã có nguồn tự điền trong danh mục (xem `field-catalog.ts`).
 */
export const REQUIRED_VARS_CHO_KIEM: Record<string, string[]> = {
  QD_KHOI_TO_VU_AN: ['tenVuAn'],
  QD_KHOI_TO_BI_CAN: ['tenVuAn'],
  KET_LUAN_DIEU_TRA: ['tenVuAn'],
  QD_TAM_DINH_CHI_DT: ['tenVuAn'],
  BB_HOI_CUNG_BI_CAN: [],
  QD_PHAN_CONG_GIAI_QUYET: ['tenVuViec', 'dieuTraVien'],
  QD_KHOI_TO_TU_NGUON_TIN: ['tenVuViec'],
  QD_KHONG_KHOI_TO: ['tenVuViec'],
  TB_KET_QUA_GIAI_QUYET: ['tenVuViec'],
  QD_TAM_DINH_CHI_GQ: ['tenVuViec'],
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
        const req = new Set(REQUIRED_VARS_CHO_KIEM[spec.code] ?? []);
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
    const variables = buildVariables(buffer, spec.entityType, REQUIRED_VARS_CHO_KIEM[spec.code] ?? []);

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

/**
 * Thư mục 7 file .docx mẫu Đơn thư — SEED ASSET (đi cùng prisma/, được deploy ship).
 * __dirname = backend/prisma (ts-node) → backend/prisma/seed-assets/petition-docx.
 * (Trước PR4 đọc từ backend/templates/docx + dist asset của engine tĩnh; engine tĩnh đã gỡ.)
 */
function resolvePetitionDocxDir(): string {
  return timThuMucMau(__dirname, 'petition-docx');
}

/**
 * Seed 7 mẫu Đơn thư tĩnh (templates/docx/*.docx) vào hệ template ĐỘNG (entityType=DON_THU).
 * - `code` = DocumentType (BIEN_NHAN…) để cấp số/render-log tương thích engine cũ.
 * - `needsNumber=true` + `numberSeriesId` theo DOC_TYPE_TO_SERIES (series dùng chung PHIEU_CHUYEN/THONG_BAO).
 * - GATE: buildPetitionSeedVariables throw nếu placeholder ngoài catalog DON_THU.
 * - Idempotent create-if-absent (KHÔNG ghi đè bản admin đã sửa); backfill required nếu chưa cấu hình.
 * - `SEED_TEMPLATES_FORCE_FILE=1`: OPT-IN ghi đè fileBytes+variables của bản đã có từ
 *   file trên đĩa. Dùng khi PC01 phát hành biểu mẫu mới (vd TT 128/2025/TT-BCA) và cần
 *   đẩy vào môi trường đã seed. Mặc định TẮT để không xoá tuỳ chỉnh của admin.
 */
export async function seedPetitionTemplates(
  prisma: PrismaClient,
): Promise<{ created: number; skipped: number; updated: number }> {
  let created = 0;
  let skipped = 0;
  let updated = 0;
  const forceFile = process.env.SEED_TEMPLATES_FORCE_FILE === '1';

  const admin = await (prisma as any).user.findFirst({
    where: { role: { name: { in: ['SUPER_ADMIN', 'ADMIN'] } } },
    select: { id: true },
  });
  if (!admin) {
    console.warn('⚠ Không tìm thấy ADMIN — bỏ qua seed mẫu Đơn thư (non-fatal).');
    return { created, skipped, updated };
  }

  const dir = resolvePetitionDocxDir();
  for (const docType of PETITION_DOC_TYPES) {
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
    if (existing && forceFile) {
      // Ghi đè có chủ đích: dựng lại mapping từ file mới (GATE catalog bên trong).
      const variables = buildPetitionSeedVariables(docType, buffer);
      const fileSha = createHash('sha256').update(buffer).digest('hex');
      await (prisma as any).documentTemplate.update({
        where: { id: existing.id },
        data: { fileBytes: buffer, fileSha, fileName: `${docType}.docx`, variables },
      });
      updated++;
      console.log(`  ⇪ DON_THU/${docType} ĐÃ GHI ĐÈ file + mapping (force).`);
      continue;
    }
    if (existing) {
      skipped++;
      const curVars = (existing.variables as Array<{ name: string; required?: boolean }>) ?? [];
      const alreadyConfigured = curVars.some((v) => v.required === true);
      if (!alreadyConfigured) {
        // codex P1: backfill required TRÊN variables DB hiện có (KHÔNG re-detect file đĩa →
        // không ghi đè mapping/fileBytes admin đã sửa).
        const vars = markRequiredByDocType(docType, curVars as any);
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

  console.log(
    `\n✔ Seed mẫu Đơn thư: ${created} tạo mới, ${updated} ghi đè (force), ${skipped} giữ nguyên.`,
  );
  return { created, skipped, updated };
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
    // Bộ mẫu HỆ CŨ — thứ khiến hệ mới in được mọi hồ sơ như hệ cũ. Bộ trên là mẫu quyết
    // định tố tụng, đòi trường mà phần lớn hồ sơ chưa có nên không thay thế được nó.
    const c = await seedLegacyTemplates(prisma);
    console.log(
      `\nDone: vu-an/vu-viec ${JSON.stringify(a)} | don-thu ${JSON.stringify(b)} | he-cu ${JSON.stringify(c)}`,
    );
  })()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
