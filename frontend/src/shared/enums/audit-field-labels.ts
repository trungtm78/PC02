/**
 * Vietnamese labels for audit log field names (used in inline diff "Field: old → new").
 *
 * Source of truth: DTOs in backend/src/{admin,cases,incidents,petitions}/dto/.
 * Aim for 80%+ coverage of fields user actually sees in audit modal. Missing keys
 * fall back via `getFieldLabel` to the raw camelCase name.
 *
 * v0.30.0.0 (em — 2026-05-20): created for inline audit diff display.
 */
export const AUDIT_FIELD_LABELS: Record<string, string> = {
  // ── User ──────────────────────────────────────────────────────────
  firstName: 'Họ',
  lastName: 'Tên',
  fullName: 'Họ và tên',
  email: 'Email',
  phone: 'Số điện thoại',
  workId: 'Mã cán bộ',
  username: 'Tên đăng nhập',
  isActive: 'Trạng thái hoạt động',
  roleId: 'Vai trò',
  departmentId: 'Đơn vị',
  canDispatch: 'Quyền phân công',
  twoFaEnabled: 'Xác thực 2 lớp',
  mustChangePassword: 'Bắt buộc đổi mật khẩu',
  lastLoginAt: 'Lần đăng nhập gần nhất',

  // ── Case ──────────────────────────────────────────────────────────
  status: 'Trạng thái',
  name: 'Tên',
  code: 'Mã',
  crime: 'Tội danh',
  investigatorId: 'Điều tra viên',
  assignedTeamId: 'Tổ phụ trách',
  deadline: 'Hạn xử lý',
  unit: 'Đơn vị',
  subjectsCount: 'Số đối tượng',
  capDoToiPham: 'Cấp độ tội phạm',
  ngayKhoiTo: 'Ngày khởi tố',
  lyDoTamDinhChiVuAn: 'Lý do tạm đình chỉ',
  soQuyetDinhTamDinhChi: 'Số QĐ tạm đình chỉ',
  ngayTamDinhChi: 'Ngày tạm đình chỉ',
  laCongNgheCao: 'Vụ công nghệ cao',
  soLanGiaHan: 'Số lần gia hạn',
  daRaSoat: 'Đã rà soát',
  ngayRaSoat: 'Ngày rà soát',
  soQuyetDinhPhucHoi: 'Số QĐ phục hồi',
  ngayPhucHoi: 'Ngày phục hồi',
  ketQuaPhucHoiVuAn: 'Kết quả phục hồi',
  lyDoTamDinhChiText: 'Ghi chú lý do tạm đình chỉ',
  expectedDeadline: 'Hạn dự kiến',
  classifiedAt: 'Ngày phân loại',
  soLanTamDinhChi: 'Số lần tạm đình chỉ',

  // ── Incident ──────────────────────────────────────────────────────
  incidentType: 'Loại vụ việc',
  description: 'Mô tả',
  unitId: 'Đơn vị',
  canBoNhapId: 'Cán bộ nhập',
  fromDate: 'Từ ngày',
  toDate: 'Đến ngày',
  ngayDeXuat: 'Ngày đề xuất',
  ngayQuyetDinh: 'Ngày quyết định',
  doiTuongCaNhan: 'Đối tượng (cá nhân)',
  doiTuongToChuc: 'Đối tượng (tổ chức)',
  loaiDonVu: 'Loại đơn vụ việc',
  benVu: 'Bên vụ',
  donViGiaiQuyet: 'Đơn vị giải quyết',
  ketQuaXuLy: 'Kết quả xử lý',
  tinhTrangHoSo: 'Tình trạng hồ sơ',
  tinhTrangThoiHieu: 'Tình trạng thời hiệu',
  nguoiQuyetDinh: 'Người quyết định',
  soQuyetDinh: 'Số quyết định',
  lyDoKhongKhoiTo: 'Lý do không khởi tố',
  diaChiXayRa: 'Địa chỉ xảy ra',
  sdtNguoiToGiac: 'SĐT người tố giác',
  diaChiNguoiToGiac: 'Địa chỉ người tố giác',
  cmndNguoiToGiac: 'CMND người tố giác',
  lyDoTamDinhChiVuViec: 'Lý do tạm đình chỉ vụ việc',
  laCongNgheCaoVV: 'Vụ việc CNcao',
  daRaSoatVV: 'Đã rà soát vụ việc',
  ketQuaPhucHoiVuViec: 'Kết quả phục hồi vụ việc',

  // ── Petition ──────────────────────────────────────────────────────
  stt: 'Số tiếp nhận',
  receivedDate: 'Ngày tiếp nhận',
  senderName: 'Tên người gửi',
  senderBirthYear: 'Năm sinh người gửi',
  senderAddress: 'Địa chỉ người gửi',
  senderPhone: 'SĐT người gửi',
  senderEmail: 'Email người gửi',
  suspectedPerson: 'Đối tượng bị tố',
  suspectedAddress: 'Địa chỉ đối tượng bị tố',
  petitionType: 'Loại đơn',
  priority: 'Mức ưu tiên',
  summary: 'Tóm tắt',
  detailContent: 'Nội dung chi tiết',
  attachmentsNote: 'Ghi chú file đính kèm',
  assignedToId: 'Được giao cho',
  notes: 'Ghi chú',
  linkedCaseId: 'Liên kết vụ án',
};

/**
 * Look up Vietnamese label for an audit field; fall back to raw field name.
 */
export function getFieldLabel(field: string): string {
  return AUDIT_FIELD_LABELS[field] ?? field;
}
