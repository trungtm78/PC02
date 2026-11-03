/**
 * Per-field policy for what a model may write into an open create form.
 *
 * Every field of the Petition, Incident and Case forms (see khai-o-form.generated.ts) is listed here
 * explicitly. A field that is not listed is a failing CI gate (chinh-sach-o.gate.spec.ts): adding a
 * field to a form forces a conscious decision about whether a model may fill it.
 *
 *   AI_FILL                 the model may fill it; the officer reviews it on the form like any typed value.
 *   AI_FILL_MUST_CONFIRM    the model may fill it, but the officer must confirm that field before Save.
 *   NEVER_AI                officer judgement or an authority's decision; the model must never write it.
 *
 * Moving a field towards NEVER_AI is always safe. Moving it away needs a reviewed reason in the PR.
 */
export type FieldPolicy = 'AI_FILL' | 'AI_FILL_MUST_CONFIRM' | 'NEVER_AI';

export const FIELD_POLICY: Readonly<Record<string, FieldPolicy>> = {
  // Identity of the person who files the complaint: a misread digit points at the wrong person
  tenCungCap: 'AI_FILL_MUST_CONFIRM',
  sinhNamCungCap: 'AI_FILL_MUST_CONFIRM',
  cccdCungCap: 'AI_FILL_MUST_CONFIRM',
  ngayCapCccd: 'AI_FILL_MUST_CONFIRM',
  sdtCungCap: 'AI_FILL_MUST_CONFIRM',

  // Inferred legal charge, accused person, dates and amounts that drive deadlines and statistics
  crimeChinhId: 'AI_FILL_MUST_CONFIRM',
  nghiVanDoiTuong: 'AI_FILL_MUST_CONFIRM',
  ngayVietDon: 'AI_FILL_MUST_CONFIRM',
  ngayXayRa: 'AI_FILL_MUST_CONFIRM',
  'statistic.soTienBiThietHai': 'AI_FILL_MUST_CONFIRM',
  'statistic.soLuongBiHai': 'AI_FILL_MUST_CONFIRM',

  // Transfer slip details: they decide where the file came from
  nguonDon: 'AI_FILL_MUST_CONFIRM',
  loaiThongTin: 'AI_FILL_MUST_CONFIRM',
  soPhieuChuyen: 'AI_FILL_MUST_CONFIRM',
  ngayPhieuChuyen: 'AI_FILL_MUST_CONFIRM',

  // Descriptive text copied or summarised from the document; the officer still reads it on the form
  description: 'AI_FILL',
  phuongThucThuDoan: 'AI_FILL',
  noiXayRa: 'AI_FILL',
  noiXayRaPhuongXa: 'AI_FILL',
  diaChiCungCap: 'AI_FILL',
  noiCapCccd: 'AI_FILL',
  doVatTaiLieuKemTheo: 'AI_FILL',

  // Evidence and filing: created by officers after intake
  vatChungMoTa: 'NEVER_AI',
  lenhNhapKho: 'NEVER_AI',
  noiLuuTruBaoQuan: 'NEVER_AI',
  'statistic.soDangKyHoSo': 'NEVER_AI',
  'statistic.ngayDangKyHoSo': 'NEVER_AI',
  'statistic.hoSoLuu': 'NEVER_AI',
  'statistic.ngayNopLuuHoSo': 'NEVER_AI',
  'statistic.donViBaoQuanHoSo': 'NEVER_AI',

  // Assignment, routing and handling decisions
  dieuTraVienText: 'NEVER_AI',
  lanhDaoToTung: 'NEVER_AI',
  soQDPhanCongNguonTin: 'NEVER_AI',
  ngayQDPhanCongNguonTin: 'NEVER_AI',
  ngayDeXuat: 'NEVER_AI',
  phanLoaiNguonTinBanDau: 'NEVER_AI',
  ngayTiepNhanNguonTin: 'NEVER_AI',
  utdt_thoiHanUyThac: 'NEVER_AI',
  ngayGiaoDonViGiaiQuyet: 'NEVER_AI',
  huongXuLy: 'NEVER_AI',
  donViGiaiQuyet: 'NEVER_AI',
  toiDanhBanDau: 'NEVER_AI',
  supervisingUnit: 'NEVER_AI',

  // Officer judgement and notes: never written by a model
  nhanXet: 'NEVER_AI',
  ghiChuTrungDon: 'NEVER_AI',
  baoCaoBanGiamDoc: 'NEVER_AI',
  laCongNgheCao: 'NEVER_AI',
  ketQuaXuLyKhac: 'NEVER_AI',
  ghiChuKhac: 'NEVER_AI',
  deXuat: 'NEVER_AI',

  // Statistics: counted by officers after the case develops
  'statistic.ngayThongKe': 'NEVER_AI',
  'statistic.ngayPhanCongGiaiQuyetToGiac': 'NEVER_AI',
  'statistic.ngayTiepNhanTin': 'NEVER_AI',
  'statistic.ngayDauThu': 'NEVER_AI',
  'statistic.ngayPhamToiQuaTang': 'NEVER_AI',
  'statistic.ngayBatKhanCap': 'NEVER_AI',
  'statistic.ngayPhatHienDauHieu': 'NEVER_AI',
  'statistic.soTienThuHoi': 'NEVER_AI',
  'statistic.soDoiTuong': 'NEVER_AI',
  'statistic.soDoiTuongDaBat': 'NEVER_AI',
  'statistic.soDoiTuongBiBatVuAnKhac': 'NEVER_AI',
  'statistic.dieuTraMoRong': 'NEVER_AI',
  'statistic.suDungVuKhiNong': 'NEVER_AI',
  'statistic.soLuongNguoiChet': 'NEVER_AI',
  'statistic.soNguoiBiThuong': 'NEVER_AI',
  'statistic.coBangNhom': 'NEVER_AI',
  'statistic.soBangNhomBatDuoc': 'NEVER_AI',
  'statistic.soSungThuHoi': 'NEVER_AI',
  'statistic.soThuocNoThuHoi': 'NEVER_AI',
  'statistic.coVPHC': 'NEVER_AI',
  'statistic.soDoiTuongVPHC': 'NEVER_AI',
  'statistic.soNguoiBiPhatTien': 'NEVER_AI',
  'statistic.tongTienPhatHanhChinh': 'NEVER_AI',
  'statistic.soDoiTuongSuuTraHiemNghi': 'NEVER_AI',
  'statistic.coGhiAmGhiHinh': 'NEVER_AI',
  'statistic.tongSoBienBanGhiLoiKhai': 'NEVER_AI',
  'statistic.soBienBanGhiLoiKhaiCoGhiAm': 'NEVER_AI',
  'statistic.laVuAnGhiAmGhiHinh': 'NEVER_AI',
  'statistic.tongSoBienBanHoiCung': 'NEVER_AI',
  'statistic.tongSoBienBanHoiCungCoGhiAm': 'NEVER_AI',
  'statistic.soBiCanCoGhiAm': 'NEVER_AI',
  'statistic.vksYeuCauGhiAm': 'NEVER_AI',
  'statistic.soBiCanVksYeuCauGhiAm': 'NEVER_AI',
  'statistic.vuAnDaDuocXetXu': 'NEVER_AI',
  'statistic.ghiAmGhiHinhDaDuocXetXu': 'NEVER_AI',
  'statistic.coSuDungKQGhiAmTrongXetXu': 'NEVER_AI',
  'statistic.khongGAGHNhungToaYeuCau': 'NEVER_AI',

  // Prosecution and lifecycle decisions: created by authorities, not by the complainant
  soQDKhongKhoiTo: 'NEVER_AI',
  ngayQDKhongKhoiTo: 'NEVER_AI',
  canCuKhongKhoiTo: 'NEVER_AI',
  lyDoKhongKhoiTo: 'NEVER_AI',
  chuyenVuViecDonViKhac: 'NEVER_AI',
  nhapVaoVuViecSo: 'NEVER_AI',
  phanLoaiDanSu: 'NEVER_AI',
  capDoToiPham: 'NEVER_AI',
  toiDanhChinhKhoiToId: 'NEVER_AI',
  toiDanhKhacIds: 'NEVER_AI',
  soQuyetDinhKhoiTo: 'NEVER_AI',
  ngayKhoiTo: 'NEVER_AI',
  soQDNhapVuAn: 'NEVER_AI',
  ngayNhapVuAn: 'NEVER_AI',
  ghiChuNhapHoSo: 'NEVER_AI',
  soQDTachVuAn: 'NEVER_AI',
  ngayTachVuAn: 'NEVER_AI',
  soQDTachHanhVi: 'NEVER_AI',
  ngayTachHanhVi: 'NEVER_AI',
  soKLDT: 'NEVER_AI',
  ngayKLDT: 'NEVER_AI',
  soQDDieuTraLai: 'NEVER_AI',
  ngayQDDieuTraLai: 'NEVER_AI',
  soQDDinhChiVuAn: 'NEVER_AI',
  ngayDinhChiVuAn: 'NEVER_AI',
  chuyenVuAnChoCQK: 'NEVER_AI',
  soBanAnCoHieuLuc: 'NEVER_AI',
  ngayBanAnCoHieuLuc: 'NEVER_AI',
  vuViecTamDungTruoc2015: 'NEVER_AI',
  soQDTamDinhChiNguonTin: 'NEVER_AI',
  ngayQDTamDinhChiNguonTin: 'NEVER_AI',
  canCuTamDinhChiNguonTin: 'NEVER_AI',
  lyDoTamDinhChiNguonTin: 'NEVER_AI',
  ngayHetThoiHieuVuViec: 'NEVER_AI',
  khacPhucLyDoTDCVuViec: 'NEVER_AI',
  tienDoKhacPhucTDCVuViec: 'NEVER_AI',
  soPhucHoiNguonTin: 'NEVER_AI',
  ngayPhucHoiNguonTin: 'NEVER_AI',
  soQuyetDinhTamDinhChi: 'NEVER_AI',
  ngayTamDinhChi: 'NEVER_AI',
  canCuTamDinhChiVuAn: 'NEVER_AI',
  lyDoTamDinhChiVuAn: 'NEVER_AI',
  ngayHetThoiHieu: 'NEVER_AI',
  tdcKhacPhucBienBan: 'NEVER_AI',
  tdcKhacPhucLyDoBienPhap: 'NEVER_AI',
  soQuyetDinhPhucHoi: 'NEVER_AI',
  ngayPhucHoi: 'NEVER_AI',
  canCuPhucHoiVuAn: 'NEVER_AI',
};

/** Policy for a field; throws for an unclassified field so a new field can never default to "allowed". */
export function policyFor(field: string): FieldPolicy {
  const policy = FIELD_POLICY[field];
  if (!policy) throw new Error(`form field "${field}" has no AI policy`);
  return policy;
}

/** True only for the two fill policies. An unclassified field is not fillable. */
export function mayAiFill(field: string): boolean {
  const policy = FIELD_POLICY[field];
  return policy === 'AI_FILL' || policy === 'AI_FILL_MUST_CONFIRM';
}
