/**
 * Dung than loi goi luu Vu viec.
 *
 * O TRONG PHAI GUI `null`, KHONG duoc bo khoa. May chu chi ghi nhung khoa CO MAT trong loi goi
 * (`dto.X !== undefined`, xem `incidents.service.ts`), nen o bi bo khoi than loi goi thi thao
 * tac xoa bao thanh cong ma gia tri cu van nam nguyen duoi co so du lieu - can bo mo lai thay
 * dung thu minh vua xoa.
 *
 * Ban truoc dung `const s = (v) => v || undefined` cho ~45 o, tuc toan bo form Vu viec khong
 * xoa trang duoc o nao. Cung lop loi da va cho Vu an (#245) va Don thu.
 *
 * Da kiem CHIEU NGUOC truoc khi doi: moi khoa duoi day deu duoc doc lai tu chi tiet may chu
 * tra ve. O trong tren man Sua vi the that su nghia la can bo da xoa, khong phai form chua nap.
 */
import { oHeCu } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import type { IncidentFormData } from './incident-form.types';

export interface BuildIncidentPayloadOptions {
  /** Che do Sua: gui kem `metadata` de may chu GOP vao ban dang co. */
  isEditMode: boolean;
  /** Truong he cu dong. May chu GOP metadata, nen khoa da xoa phai gui `null` tuong minh. */
  metaState: Record<string, unknown>;
  /** Cot field-parity (di tru) ghi thang cot. */
  parityState: Record<string, unknown>;
}

export function buildIncidentPayload(
  formData: IncidentFormData,
  opts: BuildIncidentPayloadOptions,
): Record<string, unknown> {
  const { isEditMode, metaState, parityState } = opts;
  return {

    // Trường hệ cũ động (editable) → backend MERGE vào metadata.
    //
    // GỘP hai vùng: `metaState` là panel động, `legacyExtra` là ô hệ cũ có mặt trong 10 tab.
    // Tách đôi lúc nạp rồi gộp lại lúc lưu, nếu không thì hai vùng cùng giữ một khoá và vùng
    // ghi sau đè vùng kia — cán bộ sửa một chỗ, bấm Lưu, không đổi gì.
    ...(isEditMode ? { metadata: { ...metaState, ...formData.legacyExtra } } : {}),
    // Cột typed field-parity (di trú) → ghi thẳng cột (top-level)
    ...parityState,
    // Hệ cũ có ĐÚNG MỘT ô nội dung ("Tóm tắt nội dung"). Hệ mới tách đôi thành `name` (bắt
    // buộc, ≥5 ký tự) và `description`, và bộ di trú đổ cùng một chữ vào cả hai — đo trên máy
    // chạy 27/08/2026: 4.598/4.717 hồ sơ (97,5%) có `name` trùng y hệt `description`.
    //
    // Anh chốt giữ MỘT ô như hệ cũ, nên ô ấy ghi cả hai cột. Ghi một cột thôi thì hai cột trôi
    // khỏi nhau và danh sách hiện một đằng, form hiện một nẻo.
    name: formData.description || formData.name,
    incidentType: oHeCu(formData.incidentType),
    description: oHeCu(formData.description),
    fromDate: oHeCu(formData.fromDate),
    toDate: oHeCu(formData.toDate),
    deadline: oHeCu(formData.deadline),
    investigatorId: oHeCu(formData.investigatorId),
    canBoNhapId: oHeCu(formData.canBoNhapId),
    doiTuongCaNhan: oHeCu(formData.doiTuongCaNhan),
    doiTuongToChuc: oHeCu(formData.doiTuongToChuc),
    loaiDonVu: oHeCu(formData.loaiDonVu),
    nguonPhatTin: oHeCu(formData.nguonPhatTin),
    phuongThucTiepNhan: oHeCu(formData.phuongThucTiepNhan),
    benVu: oHeCu(formData.benVu),
    donViGiaiQuyet: oHeCu(formData.donViGiaiQuyet),
    assignedTeamId: oHeCu(formData.assignedTeamId),
    ngayDeXuat: oHeCu(formData.ngayDeXuat),
    sdtNguoiToGiac: oHeCu(formData.sdtNguoiToGiac),
    diaChiNguoiToGiac: oHeCu(formData.diaChiNguoiToGiac),
    cmndNguoiToGiac: oHeCu(formData.cmndNguoiToGiac),
    diaChiXayRa: oHeCu(formData.diaChiXayRa),
    soQuyetDinh: oHeCu(formData.soQuyetDinh),
    ngayQuyetDinh: oHeCu(formData.ngayQuyetDinh),
    soQDPhanCongNguonTin: oHeCu(formData.soQDPhanCongNguonTin),
    ngayQDPhanCongNguonTin: oHeCu(formData.ngayQDPhanCongNguonTin),
    canCuKhongKhoiTo: oHeCu(formData.canCuKhongKhoiTo),
    canCuTamDinhChi: oHeCu(formData.canCuTamDinhChi),
    phanLoaiDanSuText: oHeCu(formData.phanLoaiDanSuText),
    ketQuaXuLy: oHeCu(formData.ketQuaXuLy),
    loaiKetQua: oHeCu(formData.loaiKetQua),
    canCuKhoiToCode: oHeCu(formData.canCuKhoiToCode),
    nguoiQuyetDinh: oHeCu(formData.nguoiQuyetDinh),
    // Mang rong = can bo da bo het lua chon. Bo khoa thi lua chon cu o lai.
    lyDoKhongKhoiTo: formData.lyDoKhongKhoiTo,
    lyDoTamDinhChiVuViec: formData.lyDoTamDinhChiVuViec,
    lyDoTamDinhChi: oHeCu(formData.lyDoTamDinhChi),
    tinhTrangHoSo: oHeCu(formData.tinhTrangHoSo),
    tinhTrangThoiHieu: oHeCu(formData.tinhTrangThoiHieu),
    tienDoKhacPhucTDC: oHeCu(formData.tienDoKhacPhucTDC),
    tdcKhacPhucLyDoBienPhap: oHeCu(formData.tdcKhacPhucLyDoBienPhap),
    tdcKhacPhucBienBan: oHeCu(formData.tdcKhacPhucBienBan),
    soQuyetDinhTamDinhChiVV: oHeCu(formData.soQuyetDinhTamDinhChiVV),
    ngayTamDinhChiVV: oHeCu(formData.ngayTamDinhChiVV),
    soQuyetDinhPhucHoiVV: oHeCu(formData.soQuyetDinhPhucHoiVV),
    ngayPhucHoiVV: oHeCu(formData.ngayPhucHoiVV),
    ngayHetThoiHieuVV: oHeCu(formData.ngayHetThoiHieuVV),
    soQDKhongKhoiTo: oHeCu(formData.soQDKhongKhoiTo),
    ngayQDKhongKhoiTo: oHeCu(formData.ngayQDKhongKhoiTo),
    xacDinhVuViecTamDung: formData.xacDinhVuViecTamDung,
    // O tich: `false` la mot lua chon, khong phai "khong nhac toi".
    laCongNgheCaoVV: formData.laCongNgheCaoVV,
    lanhDaoToTung: oHeCu(formData.lanhDaoToTung),
    phanLoaiNguonTinBanDau: oHeCu(formData.phanLoaiNguonTinBanDau),
    loaiThongTin: oHeCu(formData.loaiThongTin),
    soPhieuChuyen: oHeCu(formData.soPhieuChuyen),
    ngayPhieuChuyen: oHeCu(formData.ngayPhieuChuyen),
    ngayTiepNhanNguonTin: oHeCu(formData.ngayTiepNhanNguonTin),
    ngayCapCccd: oHeCu(formData.ngayCapCccd),
    noiCapCccd: oHeCu(formData.noiCapCccd),
    toiDanhBanDau: oHeCu(formData.toiDanhBanDau),
    crimeChinhId: oHeCu(formData.crimeChinhId),
    doVatTaiLieuKemTheo: oHeCu(formData.doVatTaiLieuKemTheo),
    ngayVietDon: oHeCu(formData.ngayVietDon),
    nhanXet: oHeCu(formData.nhanXet),
    ghiChuTrungDon: oHeCu(formData.ghiChuTrungDon),
    baoCaoBanGiamDocText: oHeCu(formData.baoCaoBanGiamDocText),
    ngayGiaoDonViGiaiQuyet: oHeCu(formData.ngayGiaoDonViGiaiQuyet),
    ghiChuKhac: oHeCu(formData.ghiChuKhac),
    chuyenTuDonVi: oHeCu(formData.chuyenTuDonVi),
    chuyenDenDonVi: oHeCu(formData.chuyenDenDonVi),
    sinhNamNguoiToGiac: oHeCu(formData.sinhNamNguoiToGiac),
    dieuTraVien: oHeCu(formData.dieuTraVien),
  };
}
