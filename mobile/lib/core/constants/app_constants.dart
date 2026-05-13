// ── Auth result tokens ─────────────────────────────────────────
/// Kết quả trả về từ AuthNotifier.login().
/// KHÔNG THAY ĐỔI GIÁ TRỊ — đây là wire-protocol với auth_provider.dart.
abstract final class AppAuthResult {
  static const pending2fa = 'pending_2fa';
  static const pendingChangePassword = 'pending_change_password';
  static const success = 'success';
}

// ── All entity status string values ───────────────────────────
abstract final class AppStatus {
  // CaseStatus (Prisma enum values — source of truth: backend/prisma/schema.prisma)
  static const tiepNhan        = 'TIEP_NHAN';
  static const dangXacMinh     = 'DANG_XAC_MINH';
  static const daXacMinh       = 'DA_XAC_MINH';
  static const dangDieuTra     = 'DANG_DIEU_TRA';
  static const tamDinhChi      = 'TAM_DINH_CHI';
  static const dinhChi         = 'DINH_CHI';
  static const daKetLuan       = 'DA_KET_LUAN';
  static const dangTruyTo      = 'DANG_TRUY_TO';
  static const dangXetXu       = 'DANG_XET_XU';
  static const daLuuTru        = 'DA_LUU_TRU';
  // IncidentStatus
  static const daPhanCong      = 'DA_PHAN_CONG';
  static const daGiaiQuyet     = 'DA_GIAI_QUYET';
  static const quaHan          = 'QUA_HAN';
  static const dachuyenVuAn    = 'DA_CHUYEN_VU_AN';
  static const khongKhoiTo     = 'KHONG_KHOI_TO';
  static const chuyenXphc      = 'CHUYEN_XPHC';
  static const tdcHetThoiHieu  = 'TDC_HET_THOI_HIEU';
  static const tdcHthKhongKt   = 'TDC_HTH_KHONG_KT';
  static const phucHoiNguonTin = 'PHUC_HOI_NGUON_TIN';
  static const dachuyenDonVi   = 'DA_CHUYEN_DON_VI';
  static const daNhapVuKhac    = 'DA_NHAP_VU_KHAC';
  static const phanLoaiDanSu   = 'PHAN_LOAI_DAN_SU';
  // PetitionStatus — previously missing from status_chip.dart (bug fix)
  static const moiTiepNhan     = 'MOI_TIEP_NHAN';
  static const dangXuLy        = 'DANG_XU_LY';
  static const choPheduyet     = 'CHO_PHE_DUYET';
  static const daLuuDon        = 'DA_LUU_DON';
  // DA_GIAI_QUYET is shared with IncidentStatus — use AppStatus.daGiaiQuyet
  static const dachuyenVuViec  = 'DA_CHUYEN_VU_VIEC';
  // DA_CHUYEN_VU_AN — use AppStatus.dachuyenVuAn
}

// ── Status → Vietnamese label map ─────────────────────────────
const kStatusLabels = <String, String>{
  // CaseStatus
  AppStatus.tiepNhan:        'Tiếp nhận',
  AppStatus.dangXacMinh:     'Đang xác minh',
  AppStatus.daXacMinh:       'Đã xác minh',
  AppStatus.dangDieuTra:     'Đang điều tra',
  AppStatus.tamDinhChi:      'Tạm đình chỉ',
  AppStatus.dinhChi:         'Đình chỉ',
  AppStatus.daKetLuan:       'Đã kết luận',
  AppStatus.dangTruyTo:      'Đang truy tố',
  AppStatus.dangXetXu:       'Đang xét xử',
  AppStatus.daLuuTru:        'Đã lưu trữ',
  // IncidentStatus
  AppStatus.daPhanCong:      'Đã phân công',
  AppStatus.daGiaiQuyet:     'Đã giải quyết',
  AppStatus.quaHan:          'Quá hạn',
  AppStatus.dachuyenVuAn:    'Đã chuyển vụ án',
  AppStatus.khongKhoiTo:     'Không khởi tố',
  AppStatus.chuyenXphc:      'Chuyển XPHC',
  AppStatus.tdcHetThoiHieu:  'TĐC hết thời hiệu',
  AppStatus.tdcHthKhongKt:   'TĐC hết thời hạn',
  AppStatus.phucHoiNguonTin: 'Phục hồi nguồn tin',
  AppStatus.dachuyenDonVi:   'Đã chuyển đơn vị',
  AppStatus.daNhapVuKhac:    'Đã nhập vụ khác',
  AppStatus.phanLoaiDanSu:   'Dân sự',
  // PetitionStatus (bug fix — previously missing, showed raw enum strings)
  AppStatus.moiTiepNhan:     'Mới tiếp nhận',
  AppStatus.dangXuLy:        'Đang xử lý',
  AppStatus.choPheduyet:     'Chờ phê duyệt',
  AppStatus.daLuuDon:        'Đã lưu đơn',
  AppStatus.dachuyenVuViec:  'Đã chuyển vụ việc',
};

// ── Status color groups ────────────────────────────────────────
// Explicit sets replace fragile startsWith/contains pattern matching.
// Public so tests can pin the mapping (regression coverage for the
// duplicate-set bugs caught during eng review).

// Green = completed / resolved terminal states + dangXetXu (special case)
// phanLoaiDanSu: improvement over original slate fallback
const kGreenStatuses = <String>{
  AppStatus.daXacMinh,
  AppStatus.daKetLuan,
  AppStatus.daLuuTru,
  AppStatus.daPhanCong,
  AppStatus.daGiaiQuyet,
  AppStatus.dachuyenVuAn,
  AppStatus.chuyenXphc,
  AppStatus.dachuyenDonVi,
  AppStatus.daNhapVuKhac,
  AppStatus.phanLoaiDanSu,
  AppStatus.dangXetXu,
  AppStatus.dachuyenVuViec,
  AppStatus.daLuuDon,
};

// Yellow = suspended / pending-review states
// tdcHetThoiHieu, tdcHthKhongKt, choPheduyet: improvement over original slate
const kYellowStatuses = <String>{
  AppStatus.tamDinhChi,
  AppStatus.dinhChi,
  AppStatus.khongKhoiTo,
  AppStatus.tdcHetThoiHieu,
  AppStatus.tdcHthKhongKt,
  AppStatus.choPheduyet,
};

// Navy = in-progress / active investigation states
// phucHoiNguonTin, moiTiepNhan: improvement over original slate
const kNavyStatuses = <String>{
  AppStatus.dangXacMinh,
  AppStatus.dangDieuTra,
  AppStatus.dangTruyTo,
  AppStatus.dangXuLy,
  AppStatus.phucHoiNguonTin,
  AppStatus.moiTiepNhan,
};
// quaHan (QUA_HAN) → red, handled as explicit check in _colorFor
