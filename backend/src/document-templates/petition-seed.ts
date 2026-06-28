import { DocumentType } from './docx-loader.service';
import { detectDocxVariables } from './docx-variables.util';
import { normalizeDocxTags } from './docx-normalize.util';
import { isCatalogField } from './field-catalog';
import { TemplateVariable } from './entity-placeholders';

/**
 * Metadata seed 7 mẫu Đơn thư tĩnh (backend/templates/docx/*.docx) vào hệ template ĐỘNG
 * (entityType=DON_THU). `code` = DocumentType (giữ nguyên để render log/cấp số tương thích).
 */
export const PETITION_SEED_META: Record<
  DocumentType,
  { name: string; category: string; sortOrder: number }
> = {
  PHIEU_DE_XUAT: { name: 'Phiếu đề xuất', category: 'Khác', sortOrder: 1 },
  PHIEU_CHUYEN_NGUON_TIN: { name: 'Phiếu chuyển nguồn tin', category: 'Khác', sortOrder: 2 },
  PHIEU_CHUYEN_DON: { name: 'Phiếu chuyển đơn', category: 'Khác', sortOrder: 3 },
  THONG_BAO_CHUYEN: { name: 'Thông báo chuyển đơn', category: 'Thông báo', sortOrder: 4 },
  THONG_BAO_HUONG_DAN: { name: 'Thông báo hướng dẫn', category: 'Thông báo', sortOrder: 5 },
  THONG_BAO_TRA_LAI: { name: 'Thông báo trả lại đơn', category: 'Thông báo', sortOrder: 6 },
  BIEN_NHAN: { name: 'Biên nhận', category: 'Biên bản', sortOrder: 7 },
};

/**
 * Trường BẮT BUỘC per docType (placeholder = key catalog DON_THU) — GIỮ ĐÚNG rule của engine
 * tĩnh `getMissingFieldsForDocType` (document-export.service): mọi mẫu cần ghiTen + noiDung,
 * cộng per-docType. Chỉ mark required cho placeholder THỰC SỰ có trong file.
 */
const REQUIRED_BY_DOCTYPE: Record<DocumentType, readonly string[]> = {
  PHIEU_DE_XUAT: ['ghiTen', 'noiDung', 'nhanThay', 'deXuat'],
  PHIEU_CHUYEN_NGUON_TIN: ['ghiTen', 'noiDung', 'lyDoChuyen', 'canCuPhapLy'],
  PHIEU_CHUYEN_DON: ['ghiTen', 'noiDung', 'lyDoChuyen'],
  THONG_BAO_CHUYEN: ['ghiTen', 'noiDung'],
  THONG_BAO_HUONG_DAN: ['ghiTen', 'noiDung', 'huongDanKhoiKien'],
  THONG_BAO_TRA_LAI: ['ghiTen', 'noiDung', 'lyDoTraDon'],
  BIEN_NHAN: ['ghiTen', 'noiDung'],
};

/**
 * Dựng `variables` mapping cho 1 mẫu Đơn thư từ buffer .docx tĩnh.
 * GATE (codex P1#1/#5): mọi placeholder PHẢI ∈ catalog DON_THU (auto-fill được) — lệch → throw
 * để fail seed (không để render rỗng câm). Mark required theo rule docType (chỉ placeholder có mặt).
 */
export function buildPetitionSeedVariables(
  docType: DocumentType,
  buffer: Buffer,
): TemplateVariable[] {
  const detected = detectDocxVariables(normalizeDocxTags(buffer));
  const required = REQUIRED_BY_DOCTYPE[docType] ?? [];
  const outside = detected.filter((n) => !isCatalogField('DON_THU', n));
  if (outside.length > 0) {
    throw new Error(
      `Mẫu ${docType}: placeholder ngoài catalog DON_THU — ${outside.join(', ')}. ` +
        `Cập nhật field-catalog hoặc sửa file mẫu trước khi seed.`,
    );
  }
  // GATE 2 (codex P2): trường bắt buộc per docType PHẢI có placeholder trong file — không
  // silently bỏ business-required (giữ đúng rule static getMissingFieldsForDocType).
  const missingReq = required.filter((r) => !detected.includes(r));
  if (missingReq.length > 0) {
    throw new Error(
      `Mẫu ${docType}: thiếu placeholder bắt buộc trong file — ${missingReq.join(', ')}.`,
    );
  }
  return detected.map((name) => ({
    name,
    label: name,
    source: 'auto' as const,
    field: name,
    required: required.includes(name),
  }));
}

/**
 * (codex P1) Backfill cờ `required` lên `variables` ĐÃ CÓ trong DB (KHÔNG re-detect từ file đĩa —
 * tránh ghi đè mapping admin đã sửa / lệch fileBytes thực). Chỉ set required theo rule docType.
 */
export function markRequiredByDocType(
  docType: DocumentType,
  variables: TemplateVariable[],
): TemplateVariable[] {
  const required = new Set(REQUIRED_BY_DOCTYPE[docType] ?? []);
  return variables.map((v) => ({ ...v, required: required.has(v.name) }));
}
