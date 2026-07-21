import { BadRequestException } from '@nestjs/common';

/**
 * Field Catalog — danh mục trường khả dụng (WHITELIST) cho template động, per loại hồ sơ.
 * Là ranh giới bảo mật: admin chỉ map placeholder → field trong catalog; engine chỉ
 * resolve qua đây (không cho biểu thức tùy ý → chống SSTI). `resolve()` phủ cả trường
 * computed/derived (vd noiDung = detailContent||summary, nguonTin = nhãn enum).
 *
 * VU_AN ↔ Case (/cases), VU_VIEC ↔ Incident (/incidents), DON_THU ↔ Petition (/petitions).
 * Catalog VU_AN/VU_VIEC giữ NGUYÊN hành vi caseMap/incidentMap cũ (tương thích ngược).
 */

export type EntityType = 'VU_AN' | 'VU_VIEC' | 'DON_THU';

/**
 * Ngữ cảnh lúc render — dữ liệu KHÔNG nằm trong record.
 * `actor` = người đang đăng nhập (người bấm In). Dùng cho các dòng ký "cán bộ
 * thực hiện": người in mới là người ký, không phải người tạo đơn (`enteredBy`).
 */
export interface ResolveContext {
  actor?: { firstName?: string | null; lastName?: string | null; rank?: string | null } | null;
}

export interface FieldDef {
  key: string;
  label: string;
  group: string;
  /** `ctx` optional — resolver cũ chỉ dùng `record` vẫn chạy nguyên trạng. */
  resolve: (record: any, ctx?: ResolveContext) => string;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function fmtDate(d: unknown): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return '';
  return `ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`;
}

/** Họ tên đầy đủ từ User (firstName+lastName) — User KHÔNG có fullName. */
function personName(u: any): string {
  if (!u) return '';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
}

/** Họ tên kèm cấp bậc (rank firstName lastName) — dùng cho cán bộ trong chứng từ đơn thư. */
function rankName(u: any): string {
  if (!u) return '';
  return [u.rank, u.firstName, u.lastName].filter(Boolean).join(' ').trim();
}

/** Ngày dạng ngắn d/M/yyyy — dùng khi mẫu đã có sẵn chữ "ngày" phía trước. */
function fmtDateShort(d: unknown): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

/**
 * Cụm "HH giờ mm" cho mục "Hồi ... " của Giấy biên nhận (Mẫu 214).
 *
 * `receivedDate` được nhập dạng NGÀY (YYYY-MM-DD) nên phần giờ thường là 00:00 —
 * in ra "00 giờ 00" là BỊA số liệu trên văn bản tố tụng (và còn lệch theo timezone
 * máy chủ). Khi không có giờ thật, trả về đúng khung để trống như bản giấy PC01
 * để cán bộ điền tay.
 */
const KHUNG_GIO_TRONG = '…… giờ ……';
function fmtGioPhut(d: unknown): string {
  if (!d) return KHUNG_GIO_TRONG;
  const date = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(date.getTime())) return KHUNG_GIO_TRONG;
  const h = date.getHours();
  const m = date.getMinutes();
  if (h === 0 && m === 0) return KHUNG_GIO_TRONG; // chỉ có ngày, không có giờ thật
  return `${String(h).padStart(2, '0')} giờ ${String(m).padStart(2, '0')}`;
}

/**
 * Viết tắt tên cán bộ cho dòng "Lưu:" của văn bản — lấy chữ cái đầu của tên
 * đệm + tên gọi. VD "Phạm Văn Huy" → "V.Huy".
 */
function abbrevName(u: any): string {
  const full = personName(u);
  if (!full) return '';
  const parts = full.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length < 2) return last;
  const middle = parts[parts.length - 2];
  return `${middle.charAt(0).toUpperCase()}.${last}`;
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

/** Nhãn loại đơn (LoaiDon) — render nhãn tiếng Việt thay mã enum. */
const LOAI_DON_LABEL: Record<string, string> = {
  TO_GIAC: 'Tố giác',
  TIN_BAO: 'Tin báo',
  KIEN_NGHI_KHOI_TO: 'Kiến nghị khởi tố',
  DON_KHIEU_NAI: 'Đơn khiếu nại',
  DON_TO_CAO: 'Đơn tố cáo',
  DON_KIEN_NGHI: 'Đơn kiến nghị',
  DON_PHAN_ANH: 'Đơn phản ánh',
  KHAC: 'Khác',
};

/** Field "Số văn bản" — cấp lúc in (needsNumber), KHÔNG resolve từ record (override khi render). */
const SO_VAN_BAN: FieldDef = {
  key: 'soVanBan',
  label: 'Số văn bản (cấp khi in)',
  group: 'Văn bản',
  resolve: () => '',
};

// ── VU_AN (Case) — mirror caseMap cũ ─────────────────────────────────────────
const VU_AN_FIELDS: FieldDef[] = [
  { key: 'soVuAn', label: 'Số vụ án', group: 'Hồ sơ', resolve: (r) => s(r.caseCode) },
  { key: 'tenVuAn', label: 'Tên vụ án', group: 'Hồ sơ', resolve: (r) => s(r.name) },
  { key: 'toiDanh', label: 'Tội danh', group: 'Hồ sơ', resolve: (r) => s(r.crime) },
  { key: 'trangThai', label: 'Trạng thái', group: 'Hồ sơ', resolve: (r) => s(r.status) },
  { key: 'ngayKhoiTo', label: 'Ngày khởi tố', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.ngayKhoiTo) },
  { key: 'soQuyetDinhKhoiTo', label: 'Số QĐ khởi tố', group: 'Văn bản', resolve: (r) => s(r.soQuyetDinhKhoiTo) },
  { key: 'soKLDT', label: 'Số kết luận điều tra', group: 'Văn bản', resolve: (r) => s(r.soKLDT) },
  { key: 'ngayKLDT', label: 'Ngày KLĐT', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.ngayKLDT) },
  { key: 'soQDDinhChiVuAn', label: 'Số QĐ đình chỉ vụ án', group: 'Văn bản', resolve: (r) => s(r.soQDDinhChiVuAn) },
  { key: 'ngayDinhChiVuAn', label: 'Ngày đình chỉ vụ án', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.ngayDinhChiVuAn) },
  { key: 'dieuTraVien', label: 'Điều tra viên', group: 'Cán bộ', resolve: (r) => personName(r.investigator) },
  { key: 'donVi', label: 'Đơn vị', group: 'Cán bộ', resolve: (r) => s(r.unitRef?.name ?? r.unit ?? '') },
  SO_VAN_BAN,
];

// ── VU_VIEC (Incident) — mirror incidentMap cũ ───────────────────────────────
const VU_VIEC_FIELDS: FieldDef[] = [
  { key: 'soVuViec', label: 'Số vụ việc', group: 'Hồ sơ', resolve: (r) => s(r.code) },
  { key: 'tenVuViec', label: 'Tên vụ việc', group: 'Hồ sơ', resolve: (r) => s(r.name) },
  { key: 'nguonTin', label: 'Nguồn tin', group: 'Hồ sơ', resolve: (r) => NGUON_PHAT_TIN_LABEL[s(r.nguonPhatTin)] ?? s(r.nguonPhatTin) },
  { key: 'noiDung', label: 'Nội dung', group: 'Nội dung', resolve: (r) => s(r.description) },
  { key: 'trangThai', label: 'Trạng thái', group: 'Hồ sơ', resolve: (r) => s(r.status) },
  { key: 'ngayTiepNhan', label: 'Ngày tiếp nhận', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.ngayDeXuat) },
  { key: 'donViGiaiQuyet', label: 'Đơn vị giải quyết', group: 'Cán bộ', resolve: (r) => s(r.donViGiaiQuyet) },
  { key: 'nguoiQuyetDinh', label: 'Người quyết định', group: 'Cán bộ', resolve: (r) => s(r.nguoiQuyetDinh) },
  { key: 'soQuyetDinh', label: 'Số quyết định', group: 'Văn bản', resolve: (r) => s(r.soQuyetDinh) },
  { key: 'ngayQuyetDinh', label: 'Ngày quyết định', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.ngayQuyetDinh) },
  { key: 'dieuTraVien', label: 'Điều tra viên', group: 'Cán bộ', resolve: (r) => personName(r.investigator) },
  SO_VAN_BAN,
];

// ── DON_THU (Petition) — khớp tên placeholder 7 mẫu (buildDocxPlaceholders) ───
const DON_THU_FIELDS: FieldDef[] = [
  { key: 'teamCode', label: 'Mã đội', group: 'Đơn vị', resolve: (r) => s(r.assignedTeam?.code ?? 'Đ1') },
  { key: 'tenDoi', label: 'Tên đội', group: 'Đơn vị', resolve: (r) => s(r.assignedTeam?.name) },
  { key: 'tenDoiPhongBan', label: 'Tên phòng ban', group: 'Đơn vị', resolve: () => 'ĐỘI THAM MƯU TỔNG HỢP' },
  { key: 'diaDiem', label: 'Địa điểm', group: 'Đơn vị', resolve: () => 'Thành phố Hồ Chí Minh' },
  { key: 'ngayPhatHanh', label: 'Ngày phát hành', group: 'Mốc thời gian', resolve: () => fmtDate(new Date()) },
  { key: 'ngayNhan', label: 'Ngày nhận', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.receivedDate) },
  { key: 'ngayDon', label: 'Ngày đơn', group: 'Mốc thời gian', resolve: (r) => fmtDate(r.petitionDate ?? r.receivedDate) },
  { key: 'loaiDon', label: 'Loại đơn', group: 'Hồ sơ', resolve: (r) => (r.petitionType ? LOAI_DON_LABEL[s(r.petitionType)] ?? '' : '') },
  { key: 'ghiTen', label: 'Họ tên người gửi', group: 'Người gửi', resolve: (r) => s(r.senderName) },
  { key: 'namSinh', label: 'Năm sinh', group: 'Người gửi', resolve: (r) => s(r.senderBirthYear) },
  { key: 'diaChi', label: 'Địa chỉ', group: 'Người gửi', resolve: (r) => s(r.senderAddress) },
  { key: 'nguonDon', label: 'Nguồn đơn', group: 'Hồ sơ', resolve: (r) => s(r.nguonDon ?? r.unit ?? '') },
  { key: 'noiDung', label: 'Nội dung', group: 'Nội dung', resolve: (r) => s(r.detailContent || r.summary || '') },
  { key: 'dinhKem', label: 'Đính kèm', group: 'Nội dung', resolve: (r) => s(r.attachmentsNote) },
  { key: 'raSoatTrung', label: 'Rà soát trùng', group: 'Nghiệp vụ', resolve: (r) => s(r.raSoatTrung ?? 'Không') },
  { key: 'baoCaoBGD', label: 'Báo cáo BGĐ', group: 'Nghiệp vụ', resolve: (r) => (r.baoCaoBanGiamDoc ? 'Có' : 'Không') },
  { key: 'nhanThay', label: 'Nhận thấy', group: 'Nghiệp vụ', resolve: (r) => s(r.nhanThay) },
  { key: 'deXuat', label: 'Đề xuất', group: 'Nghiệp vụ', resolve: (r) => s(r.deXuat) },
  { key: 'lyDoChuyen', label: 'Lý do chuyển', group: 'Nghiệp vụ', resolve: (r) => s(r.lyDoChuyen) },
  { key: 'canCuPhapLy', label: 'Căn cứ pháp lý', group: 'Nghiệp vụ', resolve: (r) => s(r.canCuPhapLy) },
  { key: 'huongDanKhoiKien', label: 'Hướng dẫn khởi kiện', group: 'Nghiệp vụ', resolve: (r) => s(r.huongDanKhoiKien) },
  { key: 'lyDoTraDon', label: 'Lý do trả đơn', group: 'Nghiệp vụ', resolve: (r) => s(r.lyDoTraDon) },
  // Người KÝ = người đang đăng nhập (bấm In). Fallback người tạo đơn khi không
  // có ngữ cảnh (vd kiểm tra readiness) để không bị rỗng.
  {
    key: 'tenCanBoDeXuat',
    label: 'Cán bộ đề xuất (người in)',
    group: 'Cán bộ',
    // Fallback theo GIÁ TRỊ (không theo object): actor có thể tồn tại nhưng
    // trống họ tên → vẫn phải lùi về người tạo hồ sơ, tránh in dòng ký rỗng.
    resolve: (r, ctx) => rankName(ctx?.actor) || rankName(r.enteredBy),
  },
  { key: 'tenPhoDoiTruong', label: 'Phó đội trưởng', group: 'Cán bộ', resolve: (r) => rankName(r.assignedTeam?.members?.find((m: any) => m.isLeader)?.user) },
  { key: 'tenTruongPhong', label: 'Trưởng phòng', group: 'Cán bộ', resolve: () => '' },
  // ── Bổ sung cho bộ mẫu PC01 (TT 128/2025/TT-BCA) ──────────────────────────
  // Ngày dạng ngắn: mẫu PC01 viết "Ngày 13/7/2026, ..." (đã có chữ "ngày" sẵn)
  { key: 'ngayNhanNgan', label: 'Ngày nhận (d/M/yyyy)', group: 'Mốc thời gian', resolve: (r) => fmtDateShort(r.receivedDate) },
  { key: 'ngayDonNgan', label: 'Ngày đơn (d/M/yyyy)', group: 'Mốc thời gian', resolve: (r) => fmtDateShort(r.petitionDate ?? r.receivedDate) },
  { key: 'gioTiepNhan', label: 'Giờ tiếp nhận', group: 'Mốc thời gian', resolve: (r) => fmtGioPhut(r.receivedDate) },
  // Giấy tờ tuỳ thân người gửi (Giấy biên nhận — Mẫu 214)
  { key: 'soCCCD', label: 'Số CCCD người gửi', group: 'Người gửi', resolve: (r) => s(r.senderIdNumber) },
  { key: 'ngayCapCCCD', label: 'Ngày cấp CCCD', group: 'Người gửi', resolve: (r) => fmtDateShort(r.senderIdIssueDate) },
  { key: 'noiCapCCCD', label: 'Nơi cấp CCCD', group: 'Người gửi', resolve: (r) => s(r.senderIdIssuePlace) },
  // Đơn vị nhận chuyển đơn (Phiếu chuyển / Thông báo)
  { key: 'donViNhan', label: 'Đơn vị nhận chuyển', group: 'Đơn vị', resolve: (r) => s(r.donViXuLy) },
  // Viết tắt cán bộ soạn ở dòng "Lưu:" (vd V.Huy)
  {
    key: 'vietTatCanBo',
    label: 'Viết tắt cán bộ (người in)',
    group: 'Cán bộ',
    resolve: (r, ctx) => abbrevName(ctx?.actor) || abbrevName(r.enteredBy),
  },
  // Hằng theo mẫu PC01 — sau này có thể chuyển sang SystemSetting
  { key: 'chucVuCanBo', label: 'Chức danh/chức vụ cán bộ', group: 'Cán bộ', resolve: () => 'Cán bộ' },
  { key: 'coQuan', label: 'Cơ quan', group: 'Đơn vị', resolve: () => 'Cơ quan CSĐT Công an TP Hồ Chí Minh' },
  {
    key: 'noiTiepNhan',
    label: 'Nơi tiếp nhận đơn',
    group: 'Đơn vị',
    resolve: () =>
      'trực ban Phòng Cảnh sát Hình sự Công an TP Hồ Chí Minh, số 459 Trần Hưng Đạo, phường Cầu Ông Lãnh, TP Hồ Chí Minh',
  },
  SO_VAN_BAN,
];

export const FIELD_CATALOG: Record<EntityType, FieldDef[]> = {
  VU_AN: VU_AN_FIELDS,
  VU_VIEC: VU_VIEC_FIELDS,
  DON_THU: DON_THU_FIELDS,
};

/** Tra FieldDef theo key (null nếu không thuộc catalog). Dùng Map nội bộ tránh prototype-lookup. */
function findField(entityType: EntityType, field: string): FieldDef | undefined {
  return FIELD_CATALOG[entityType]?.find((f) => f.key === field);
}

/** Resolve giá trị 1 field từ record (+ ngữ cảnh). Field ngoài catalog → '' (an toàn). */
export function resolveField(
  entityType: EntityType,
  field: string,
  record: any,
  ctx?: ResolveContext,
): string {
  const def = findField(entityType, field);
  return def ? s(def.resolve(record, ctx)) : '';
}

/** Danh mục {key,label,group} cho dropdown admin (KHÔNG kèm resolve). */
export function listCatalog(entityType: EntityType): Array<{ key: string; label: string; group: string }> {
  return (FIELD_CATALOG[entityType] ?? []).map(({ key, label, group }) => ({ key, label, group }));
}

/** Tập key catalog của 1 entityType (gồm soVanBan). */
export function catalogKeys(entityType: EntityType): string[] {
  return (FIELD_CATALOG[entityType] ?? []).map((f) => f.key);
}

/** Field có thuộc catalog của entityType không (auto-fill được). */
export function isCatalogField(entityType: string, field: string): boolean {
  return !!findField(entityType as EntityType, field);
}

/** Whitelist guard: field PHẢI thuộc catalog, ngược lại 400 (chống map field ngoài whitelist). */
export function assertFieldInCatalog(entityType: EntityType, field: string): void {
  if (!findField(entityType, field)) {
    throw new BadRequestException(`Field "${field}" không thuộc danh mục trường của ${entityType}`);
  }
}
