/**
 * Danh mục biến chuẩn (auto-map) cho template động vụ việc/vụ án.
 * - VU_AN ↔ model Case (/cases). VU_VIEC ↔ model Incident (/incidents).
 * - manualValues: bổ sung/ghi đè biến không thuộc catalog (biến nhập tay khi in).
 * - Escape token người dùng ({ } < >) chống injection docxtemplater.
 */

function fmtDate(d: unknown): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return '';
  return `ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`;
}

function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Họ tên đầy đủ từ User (firstName+lastName) — User KHÔNG có fullName (codex P2). */
function personName(u: any): string {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
}

/** Escape ký tự cú pháp docxtemplater trong giá trị user. */
function esc(v: string): string {
  return v.replace(/\{/g, '❴').replace(/\}/g, '❵').replace(/</g, '‹').replace(/>/g, '›');
}

function caseMap(r: any): Record<string, string> {
  return {
    soVuAn: s(r.caseCode),
    tenVuAn: s(r.name),
    toiDanh: s(r.crime),
    trangThai: s(r.status),
    ngayKhoiTo: fmtDate(r.ngayKhoiTo),
    soQuyetDinhKhoiTo: s(r.soQuyetDinhKhoiTo),
    soKLDT: s(r.soKLDT),
    ngayKLDT: fmtDate(r.ngayKLDT),
    soQDDinhChiVuAn: s(r.soQDDinhChiVuAn),
    ngayDinhChiVuAn: fmtDate(r.ngayDinhChiVuAn),
    dieuTraVien: personName(r.investigator),
    donVi: s(r.unitRef?.name ?? r.unit ?? ''),
  };
}

function incidentMap(r: any): Record<string, string> {
  return {
    soVuViec: s(r.code),
    tenVuViec: s(r.name),
    nguonTin: s(r.nguonPhatTin),
    noiDung: s(r.description),
    trangThai: s(r.status),
    ngayTiepNhan: fmtDate(r.fromDate),
    donViGiaiQuyet: s(r.donViGiaiQuyet),
    nguoiQuyetDinh: s(r.nguoiQuyetDinh),
    soQuyetDinh: s(r.soQuyetDinh),
    ngayQuyetDinh: fmtDate(r.ngayQuyetDinh),
    dieuTraVien: personName(r.investigator),
  };
}

export function buildEntityPlaceholders(
  entityType: 'VU_VIEC' | 'VU_AN',
  record: any,
  manualValues: Record<string, string> = {},
): Record<string, string> {
  const base = entityType === 'VU_AN' ? caseMap(record) : incidentMap(record);
  const merged: Record<string, string> = { ...base, ...manualValues };
  // escape mọi giá trị (cả manual) — giá trị do người dùng nhập.
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) out[k] = esc(s(v));
  return out;
}
