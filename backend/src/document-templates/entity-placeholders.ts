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

/** Nhãn tiếng Việt cho enum NguonPhatTin (Đ.144 BLTTHS) — render nhãn thay vì mã enum. */
const NGUON_PHAT_TIN_LABEL: Record<string, string> = {
  CA_NHAN_TO_GIAC: 'Cá nhân tố giác',
  CO_QUAN_NHA_NUOC: 'Cơ quan nhà nước',
  TO_CHUC: 'Tổ chức',
  CA_NHAN_BAO_TIN: 'Cá nhân báo tin',
  PHUONG_TIEN_TRUYEN_THONG: 'Phương tiện thông tin đại chúng',
  VIEN_KIEM_SAT: 'Viện kiểm sát nhân dân',
  THANH_TRA: 'Cơ quan thanh tra',
  KIEM_TOAN: 'Cơ quan kiểm toán',
  TOA_AN: 'Tòa án nhân dân',
  CO_QUAN_KHAC: 'Cơ quan nhà nước khác',
};

function incidentMap(r: any): Record<string, string> {
  return {
    soVuViec: s(r.code),
    tenVuViec: s(r.name),
    // nguonPhatTin là enum (Đ.144) → render NHÃN tiếng Việt, không phải mã enum (codex PR3).
    nguonTin: NGUON_PHAT_TIN_LABEL[s(r.nguonPhatTin)] ?? s(r.nguonPhatTin),
    noiDung: s(r.description),
    trangThai: s(r.status),
    // Ngày tiếp nhận nguồn tin = ngayDeXuat (Đ.146), KHÔNG phải fromDate (ngày bắt đầu vụ việc) — codex PR3.
    ngayTiepNhan: fmtDate(r.ngayDeXuat),
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

/**
 * Tập biến TỰ ĐIỀN (auto) cho từng loại hồ sơ = key catalog + `soVanBan` (số cấp lúc in).
 * Dùng để phân loại biến phát hiện trong .docx: thuộc tập này → auto, ngoài → nhập tay (manual).
 */
const AUTO_PLACEHOLDER_KEYS: Record<'VU_AN' | 'VU_VIEC', readonly string[]> = {
  VU_AN: [...Object.keys(caseMap({})), 'soVanBan'],
  VU_VIEC: [...Object.keys(incidentMap({})), 'soVanBan'],
};

/** Biến `name` có tự điền được cho `entityType` không (ngoài tập → phải nhập tay khi in). */
export function isAutoPlaceholder(entityType: string, name: string): boolean {
  const keys = AUTO_PLACEHOLDER_KEYS[entityType as 'VU_AN' | 'VU_VIEC'];
  return keys ? keys.includes(name) : false;
}

/**
 * PR2 — placeholder AUTO map tới CỘT đơn giản (text) trên hồ sơ → khi thiếu, FE cho "Lưu bổ sung"
 * PUT vào case/incident (persist). Placeholder ngoài map (relation/computed/enum/date như dieuTraVien,
 * soVuAn, nguonTin, ngày…) → savable=false → nhập tại popup làm manualValues override khi xuất.
 */
export const DYNAMIC_EXPORT_SAVABLE: Record<'VU_AN' | 'VU_VIEC', Record<string, { column: string; type: 'text' | 'textarea' }>> = {
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
};
