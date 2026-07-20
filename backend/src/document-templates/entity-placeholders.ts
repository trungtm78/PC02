import {
  EntityType,
  resolveField,
  catalogKeys,
  isCatalogField,
} from './field-catalog';
import { Delimiters, DEFAULT_DELIMITERS } from './docx-variables.util';

/**
 * Cầu nối record → placeholder cho template động. Nguồn dữ liệu auto = Field Catalog
 * (field-catalog.ts). Hai chế độ:
 *  - buildEntityPlaceholders: map TẤT CẢ catalog key (placeholder = key) — giữ hành vi
 *    cũ cho VU_AN/VU_VIEC + readiness.
 *  - buildTemplatePlaceholders: MAPPING-DRIVEN theo `template.variables` (placeholder
 *    tên tự do → field), escape theo cặp delimiter của template.
 */

function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Escape token cú pháp docxtemplater mặc định `{ } < >` (homoglyph) — delimiter `{ }`. */
function escDefault(v: string): string {
  return v.replace(/\{/g, '❴').replace(/\}/g, '❵').replace(/</g, '‹').replace(/>/g, '›');
}

/**
 * Escape giá trị người dùng theo CẶP DELIMITER của template (Q2 — không hardcode `{ }`).
 * - `{ }`: dùng homoglyph (tương thích hành vi cũ).
 * - delimiter khác: chèn ZWSP phá chuỗi delimiter trong giá trị → không tạo tag giả.
 */
export function escapeForDelimiters(v: string, d: Delimiters = DEFAULT_DELIMITERS): string {
  if (!v) return v;
  if (d.start === '{' && d.end === '}') return escDefault(v);
  const ZWSP = String.fromCharCode(0x200b); // zero-width space — phá chuỗi delimiter, vô hình
  const brk = (seq: string): string =>
    seq.length <= 1 ? `${seq}${ZWSP}` : seq.split('').join(ZWSP);
  let out = v;
  if (d.start) out = out.split(d.start).join(brk(d.start));
  if (d.end) out = out.split(d.end).join(brk(d.end));
  return out;
}

/**
 * Map TẤT CẢ catalog key của entityType → giá trị (placeholder = key). Giữ NGUYÊN hành vi
 * cũ (caseMap/incidentMap). manualValues bổ sung/ghi đè. Escape mặc định `{ }`.
 */
export function buildEntityPlaceholders(
  entityType: EntityType,
  record: any,
  manualValues: Record<string, string> = {},
): Record<string, string> {
  const base: Record<string, string> = {};
  for (const key of catalogKeys(entityType)) base[key] = resolveField(entityType, key, record);
  const merged: Record<string, string> = { ...base, ...manualValues };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) out[k] = escDefault(s(v));
  return out;
}

/** 1 biến template (cấu hình mapping admin khai). */
export interface TemplateVariable {
  name: string;
  label?: string;
  source: 'auto' | 'manual';
  field?: string;
  required?: boolean;
}

/**
 * MAPPING-DRIVEN: dựng placeholder keyed theo `variable.name` (tên hiển thị tự do trong file).
 *  - auto: giá trị = resolveField(field ?? name). Field đặc biệt `soVanBan` lấy từ
 *    manualValues['soVanBan'] (số cấp lúc in).
 *  - manual: giá trị = manualValues[name].
 * Escape mọi giá trị theo cặp delimiter của template.
 */
export function buildTemplatePlaceholders(
  entityType: EntityType,
  variables: TemplateVariable[],
  record: any,
  manualValues: Record<string, string> = {},
  delimiters: Delimiters = DEFAULT_DELIMITERS,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of variables) {
    const fieldKey = v.field ?? v.name;
    let raw: string;
    if (v.source === 'manual') {
      raw = manualValues[v.name] ?? '';
    } else if (fieldKey === 'soVanBan') {
      raw = manualValues['soVanBan'] ?? '';
    } else {
      // AUTO: manualValues[name] override (popup "bổ sung thông tin thiếu" điền auto-field rỗng);
      // không có thì resolve từ record. KHÔNG để mất giá trị người dùng nhập (codex P1).
      raw = manualValues[v.name] ?? resolveField(entityType, fieldKey, record);
    }
    out[v.name] = escapeForDelimiters(s(raw), delimiters);
  }
  return out;
}

/** Biến `name` có tự điền được cho `entityType` không (thuộc Field Catalog → auto). */
export function isAutoPlaceholder(entityType: string, name: string): boolean {
  return isCatalogField(entityType, name);
}

/**
 * PR2 — placeholder AUTO map tới CỘT đơn giản (text) trên hồ sơ → khi thiếu, FE "Lưu bổ sung"
 * PUT vào case/incident (persist). Ngoài map → savable=false → nhập tại popup (manualValues).
 * (DON_THU bổ sung ở PR3.)
 */
export const DYNAMIC_EXPORT_SAVABLE: Record<
  EntityType,
  Record<string, { column: string; type: 'text' | 'textarea' }>
> = {
  VU_AN: {
    tenVuAn: { column: 'name', type: 'text' },
    toiDanh: { column: 'crime', type: 'text' },
    soQuyetDinhKhoiTo: { column: 'soQuyetDinhKhoiTo', type: 'text' },
    soKLDT: { column: 'soKLDT', type: 'text' },
    soQDDinhChiVuAn: { column: 'soQDDinhChiVuAn', type: 'text' },
  },
  VU_VIEC: {
    tenVuViec: { column: 'name', type: 'text' },
    noiDung: { column: 'description', type: 'textarea' },
    soQuyetDinh: { column: 'soQuyetDinh', type: 'text' },
    nguoiQuyetDinh: { column: 'nguoiQuyetDinh', type: 'text' },
    donViGiaiQuyet: { column: 'donViGiaiQuyet', type: 'text' },
  },
  // DON_THU: placeholder (catalog key) → cột phẳng Petition → FE "Lưu bổ sung vào đơn" PUT /petitions/:id.
  DON_THU: {
    ghiTen: { column: 'senderName', type: 'text' },
    noiDung: { column: 'detailContent', type: 'textarea' },
    nhanThay: { column: 'nhanThay', type: 'textarea' },
    deXuat: { column: 'deXuat', type: 'textarea' },
    lyDoChuyen: { column: 'lyDoChuyen', type: 'textarea' },
    canCuPhapLy: { column: 'canCuPhapLy', type: 'textarea' },
    huongDanKhoiKien: { column: 'huongDanKhoiKien', type: 'textarea' },
    lyDoTraDon: { column: 'lyDoTraDon', type: 'textarea' },
    // Bộ mẫu PC01: đơn vị nhận chuyển đơn — bắt buộc ở Phiếu chuyển / Thông báo chuyển.
    donViNhan: { column: 'donViXuLy', type: 'text' },
  },
};
