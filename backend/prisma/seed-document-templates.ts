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
/**
 * Trường KHÔNG có nguồn dữ liệu ở bất kỳ hệ nào — bắt buộc chúng là khoá vĩnh viễn một mẫu.
 *
 * Đo trên máy thật 28/08/2026: `soKLDT` 0/3.673 vụ án, `nguonTin` và `nguoiQuyetDinh` 0/4.848
 * vụ việc, và bản gốc hệ cũ cũng 0. `gioBatDau`/`diaDiem` thì chỉ cán bộ mới biết.
 *
 * Seed GỠ cờ bắt buộc khỏi đúng những tên này kể cả khi admin đã cấu hình — vì không cấu hình
 * nào làm chúng có dữ liệu được.
 */
/**
 * Đồng bộ NGUỒN của biến theo danh mục hiện tại.
 *
 * Biến lưu trong cơ sở dữ liệu ghi sẵn `source` từ lần seed trước. Khi danh mục được bổ sung
 * khoá tự điền — như `toiDanh`, `hoTenBiCan`, `lyDo`, `ketQua`, `noiXayRa` ngày 28/08/2026 —
 * bản ghi cũ vẫn là `manual`, mà `manual` + `required` thì luật sẵn sàng-in coi LUÔN là thiếu.
 *
 * Không đồng bộ thì chữa danh mục xong máy thật vẫn khoá: đo sau lần nạp đầu, Đơn thư 14/14
 * nhưng Vụ việc 2/6 và Vụ án 3/8 — đúng những mẫu có biến vừa chuyển sang tự điền.
 *
 * `field` phải gán kèm: thiếu nó thì engine không biết lấy dữ liệu ở đâu và in ra ô trống.
 */
/**
 * Kéo cờ bắt buộc về đúng bảng khai — chạy có chủ đích, KHÔNG mặc định.
 *
 * Sau khi rút gọn danh sách bắt buộc, cơ sở dữ liệu vẫn giữ cờ cũ do seed lần trước đặt
 * (`lyDo`, `noiXayRa`, `hoTenBiCan`, `ketQua`…). Những trường ấy CÓ nguồn dữ liệu nên không
 * thuộc diện "gỡ vì không có nguồn", nhưng hồ sơ chưa nhập thì vẫn chặn in — đo trên máy thật
 * 28/08/2026: 8/28 mẫu còn khoá vì đúng lý do này.
 *
 * Không ghi đè mặc định: admin có quyền tự bật cờ cho mẫu của họ. Bật bằng cờ môi trường
 * `SEED_TEMPLATES_SYNC_REQUIRED=1` khi cần kéo cấu hình về đúng bảng khai.
 */
export function dongBoCoBatBuoc(
  batBuoc: readonly string[],
  vars: Array<{ name: string; [k: string]: unknown }>,
): Array<Record<string, unknown>> {
  const req = new Set(batBuoc);
  return vars.map((v) => ({ ...v, required: req.has(v.name) }));
}

export function dongBoNguonBien(
  entityType: string,
  vars: Array<{
    name: string;
    label?: string;
    source?: string;
    field?: string;
    required?: boolean;
    nguonDoAdminDat?: boolean;
  }>,
): Array<Record<string, unknown>> {
  return vars.map((v) => {
    // Admin đã cố ý đặt nguồn cho biến này thì để yên. Đồng bộ sinh ra để chữa bản ghi CŨ,
    // không phải để lật lựa chọn của người dùng — xem `nguonDoAdminDat` ở entity-placeholders.ts.
    if (v.nguonDoAdminDat) return { ...v };
    const tuDien = isAutoPlaceholder(entityType, v.name);
    return {
      ...v,
      source: tuDien ? 'auto' : 'manual',
      ...(tuDien ? { field: v.field ?? v.name } : {}),
    };
  });
}

export const KHONG_CO_NGUON = new Set([
  'soKLDT',
  'nguonTin',
  'nguoiQuyetDinh',
  'gioBatDau',
  'diaDiem',
  // Đơn thư: `deXuat` chỉ 90/47.169 hồ sơ có (bản gốc hệ cũ 1/8.000), `donViNhan` đọc
  // `donViXuLy` — 0/47.169. Bắt buộc chúng là khoá bốn mẫu đơn thư cho 99,8% hồ sơ.
  'deXuat',
  'donViNhan',
]);

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
      const curVars =
        (existing.variables as Array<{
          name: string;
          label?: string;
          source?: string;
          field?: string;
          required?: boolean;
        }>) ?? [];
      const req = new Set(REQUIRED_VARS_CHO_KIEM[spec.code] ?? []);

      // Chỉ GỠ cờ bắt buộc khỏi những trường mà hệ thống không có nguồn dữ liệu, KHÔNG đụng
      // cờ admin tự bật cho trường khác.
      //
      // Bản trước bỏ qua toàn bộ khi mẫu "đã có cấu hình" — mà mọi môi trường đã chạy seed
      // đều rơi vào đó, nên danh sách bắt buộc thu hẹp KHÔNG BAO GIỜ tới được máy thật và
      // mẫu vẫn bị khoá y như cũ. Đây là chỗ bản vá này suýt thành vô nghĩa.
      const daGoBo = curVars.filter((v) => v.required === true && !req.has(v.name) && KHONG_CO_NGUON.has(v.name));
      const thieuBatBuoc = curVars.filter((v) => v.required !== true && req.has(v.name));
      const chuaCauHinh = !curVars.some((v) => v.required === true);

      // Đồng bộ nguồn LUÔN chạy, kể cả khi không có cờ nào phải gỡ.
      const dongBoBatBuoc = process.env['SEED_TEMPLATES_SYNC_REQUIRED'] === '1';
      const daDongBo = dongBoNguonBien(spec.entityType, curVars);
      const nguonDoi = daDongBo.some((v, i) => v['source'] !== curVars[i]?.source);

      if (chuaCauHinh || daGoBo.length > 0 || nguonDoi || dongBoBatBuoc) {
        const vars = dongBoBatBuoc
          ? dongBoCoBatBuoc(REQUIRED_VARS_CHO_KIEM[spec.code] ?? [], daDongBo as never)
          : daDongBo.map((v) => ({
              ...v,
              required: chuaCauHinh
                ? req.has(String(v['name']))
                : v['required'] === true && !KHONG_CO_NGUON.has(String(v['name'])),
            }));
        await (prisma as any).documentTemplate.update({ where: { id: existing.id }, data: { variables: vars } });
        console.log(
          `  ↻ ${spec.entityType}/${spec.code} ${chuaCauHinh ? 'đặt' : 'cập nhật'} biến` +
            (daGoBo.length ? ` · bỏ bắt buộc ${daGoBo.map((v) => v.name).join(', ')}` : '') +
            (nguonDoi ? ' · đồng bộ nguồn' : ''),
        );
      } else if (thieuBatBuoc.length) {
        console.log(`  → ${spec.entityType}/${spec.code} giữ nguyên cấu hình của admin.`);
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
      const curVars =
        (existing.variables as Array<{
          name: string;
          label?: string;
          source?: string;
          field?: string;
          required?: boolean;
        }>) ?? [];
      const chuaCauHinh = !curVars.some((v) => v.required === true);
      const canGoBo = curVars.filter((v) => v.required === true && KHONG_CO_NGUON.has(v.name));

      const daDongBoDT = dongBoNguonBien('DON_THU', curVars);
      const nguonDoiDT = daDongBoDT.some((v, i) => v['source'] !== curVars[i]?.source);

      if (chuaCauHinh) {
        // codex P1: backfill required TRÊN variables DB hiện có (KHÔNG re-detect file đĩa →
        // không ghi đè mapping/fileBytes admin đã sửa).
        const vars = markRequiredByDocType(docType, daDongBoDT as any);
        await (prisma as any).documentTemplate.update({
          where: { id: existing.id },
          data: { variables: vars },
        });
        console.log(`  ↻ DON_THU/${docType} backfill required.`);
      } else if (canGoBo.length || nguonDoiDT) {
        // GỠ cờ bắt buộc khỏi trường không có nguồn dữ liệu — không cấu hình nào làm chúng có
        // dữ liệu được, nên giữ lại chỉ là khoá mẫu vĩnh viễn. Cờ admin đặt cho trường KHÁC
        // giữ nguyên.
        const vars = daDongBoDT.map((v) => ({
          ...v,
          required: v['required'] === true && !KHONG_CO_NGUON.has(String(v['name'])),
        }));
        await (prisma as any).documentTemplate.update({
          where: { id: existing.id },
          data: { variables: vars },
        });
        console.log(`  ↻ DON_THU/${docType} gỡ cờ bắt buộc: ${canGoBo.map((v) => v.name).join(', ')}`);
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
