import { detectDocxVariables } from './docx-variables.util';
import { normalizeDocxTags } from './docx-normalize.util';
import { isCatalogField } from './field-catalog';
import { TemplateVariable } from './entity-placeholders';

/**
 * 7 mã chứng từ Đơn thư (entityType=DON_THU). `code` template = mã này để cấp số/render-log
 * tương thích. Trước đây sống trong docx-loader.service (engine tĩnh, đã gỡ ở PR4) — chuyển về
 * đây làm nhà trung lập cho hệ ĐỘNG (seed dùng để duyệt 7 mẫu).
 */
export const PETITION_DOC_TYPES = [
  'PHIEU_DE_XUAT',
  'PHIEU_CHUYEN_NGUON_TIN',
  'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN',
  'THONG_BAO_HUONG_DAN',
  'THONG_BAO_TRA_LAI',
  'BIEN_NHAN',
] as const;
export type DocumentType = (typeof PETITION_DOC_TYPES)[number];

/**
 * Map docType → series cấp số (seed set `numberSeriesId` khi tạo mẫu). Series dùng chung:
 * PHIEU_CHUYEN_NGUON_TIN + PHIEU_CHUYEN_DON → 'PHIEU_CHUYEN'; THONG_BAO_CHUYEN + THONG_BAO_TRA_LAI → 'THONG_BAO'.
 */
export const DOC_TYPE_TO_SERIES = {
  PHIEU_DE_XUAT: 'PHIEU_DE_XUAT',
  PHIEU_CHUYEN_NGUON_TIN: 'PHIEU_CHUYEN',
  PHIEU_CHUYEN_DON: 'PHIEU_CHUYEN',
  THONG_BAO_CHUYEN: 'THONG_BAO',
  THONG_BAO_HUONG_DAN: 'HUONG_DAN',
  THONG_BAO_TRA_LAI: 'THONG_BAO',
  BIEN_NHAN: 'BIEN_NHAN',
} as const satisfies Record<DocumentType, string>;

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
