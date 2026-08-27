/**
 * Hinh dang du lieu form Vu viec.
 *
 * Tach khoi than trang de bo ca kiem dung payload khong phai keo ca trang 1.068 dong vao.
 */
export interface IncidentFormData {
  name: string;
  incidentType: string;
  description: string;
  fromDate: string;
  toDate: string;
  deadline: string;
  doiTuongCaNhan: string;
  doiTuongToChuc: string;
  loaiDonVu: string;
  nguonPhatTin: string;
  phuongThucTiepNhan: string;
  benVu: string;
  donViGiaiQuyet: string;     // Text label
  assignedTeamId: string;     // FK Team for DataScope
  ngayDeXuat: string;
  sdtNguoiToGiac: string;
  diaChiNguoiToGiac: string;
  cmndNguoiToGiac: string;
  diaChiXayRa: string;
  canBoNhapId: string;
  investigatorId: string;
  ketQuaXuLy: string;
  // PR 5 v0.38.4.0 — Loại kết quả chuẩn hóa + Căn cứ khởi tố Đ.143 (Wireframe 5)
  loaiKetQua: string;
  canCuKhoiToCode: string;
  soQuyetDinh: string;
  ngayQuyetDinh: string;
  nguoiQuyetDinh: string;
  lyDoKhongKhoiTo: string[];
  lyDoTamDinhChiVuViec: string[];
  lyDoTamDinhChi: string;
  tinhTrangThoiHieu: string;
  tinhTrangHoSo: string;
  // Field-parity hệ thống cũ (giai đoạn nguồn tin)
  soQDPhanCongNguonTin: string;
  ngayQDPhanCongNguonTin: string;
  canCuKhongKhoiTo: string;
  canCuTamDinhChi: string;
  phanLoaiDanSuText: string;
  // Field-parity: TĐC + QĐ tạm đình chỉ/phục hồi + công nghệ cao
  tienDoKhacPhucTDC: string;
  tdcKhacPhucLyDoBienPhap: string;
  tdcKhacPhucBienBan: string;
  soQuyetDinhTamDinhChiVV: string;
  ngayTamDinhChiVV: string;
  soQuyetDinhPhucHoiVV: string;
  ngayPhucHoiVV: string;
  ngayHetThoiHieuVV: string;
  soQDKhongKhoiTo: string;
  ngayQDKhongKhoiTo: string;
  xacDinhVuViecTamDung: boolean;
  laCongNgheCaoVV: boolean;

  // ── Ô của bố cục hệ cũ (27/08/2026) ─────────────────────────────────────────────────
  // Cột đã có sẵn trong bảng `incidents` và bộ di trú vẫn đổ vào; form thì chưa từng hiện
  // chúng, nên cán bộ mở hồ sơ di trú ra thấy trống dù dữ liệu vẫn nằm dưới cơ sở dữ liệu.
  lanhDaoToTung: string;
  phanLoaiNguonTinBanDau: string;
  loaiThongTin: string;
  soPhieuChuyen: string;
  ngayPhieuChuyen: string;
  ngayTiepNhanNguonTin: string;
  ngayCapCccd: string;
  noiCapCccd: string;
  toiDanhBanDau: string;
  crimeChinhId: string;
  doVatTaiLieuKemTheo: string;
  ngayVietDon: string;
  nhanXet: string;
  ghiChuTrungDon: string;
  baoCaoBanGiamDocText: string;
  ngayGiaoDonViGiaiQuyet: string;
  ghiChuKhac: string;
  chuyenTuDonVi: string;
  chuyenDenDonVi: string;
  sinhNamNguoiToGiac: string;
  dieuTraVien: string;

  /**
   * Ô hệ cũ CHƯA có cột riêng trên Vụ việc — giai đoạn khởi tố, vụ án, thống kê.
   *
   * Cán bộ vẫn thấy ô đúng chỗ như hệ cũ và giá trị vẫn lưu, chỉ là lưu ở `metadata`. Máy chủ
   * GỘP metadata nên khoá đã xoá phải gửi `null` tường minh, không được vắng khoá.
   */
  legacyExtra: Record<string, unknown>;
}

export const INITIAL_INCIDENT_FORM: IncidentFormData = {
  name: "",
  incidentType: "",
  description: "",
  fromDate: "",
  toDate: "",
  deadline: "",
  doiTuongCaNhan: "",
  doiTuongToChuc: "",
  loaiDonVu: "",
  nguonPhatTin: "",
  phuongThucTiepNhan: "",
  benVu: "",
  donViGiaiQuyet: "",
  assignedTeamId: "",
  ngayDeXuat: "",
  sdtNguoiToGiac: "",
  diaChiNguoiToGiac: "",
  cmndNguoiToGiac: "",
  diaChiXayRa: "",
  canBoNhapId: "",
  investigatorId: "",
  ketQuaXuLy: "",
  loaiKetQua: "",
  canCuKhoiToCode: "",
  soQuyetDinh: "",
  ngayQuyetDinh: "",
  nguoiQuyetDinh: "",
  lyDoKhongKhoiTo: [],
  lyDoTamDinhChiVuViec: [],
  lyDoTamDinhChi: "",
  tinhTrangThoiHieu: "",
  tinhTrangHoSo: "",
  soQDPhanCongNguonTin: "", ngayQDPhanCongNguonTin: "", canCuKhongKhoiTo: "",
  canCuTamDinhChi: "", phanLoaiDanSuText: "",
  tienDoKhacPhucTDC: "", tdcKhacPhucLyDoBienPhap: "", tdcKhacPhucBienBan: "",
  soQuyetDinhTamDinhChiVV: "", ngayTamDinhChiVV: "", soQuyetDinhPhucHoiVV: "",
  ngayPhucHoiVV: "", ngayHetThoiHieuVV: "", laCongNgheCaoVV: false,
  soQDKhongKhoiTo: "", ngayQDKhongKhoiTo: "", xacDinhVuViecTamDung: false,
  lanhDaoToTung: "",
  phanLoaiNguonTinBanDau: "",
  loaiThongTin: "",
  soPhieuChuyen: "",
  ngayPhieuChuyen: "",
  ngayTiepNhanNguonTin: "",
  ngayCapCccd: "",
  noiCapCccd: "",
  toiDanhBanDau: "",
  crimeChinhId: "",
  doVatTaiLieuKemTheo: "",
  ngayVietDon: "",
  nhanXet: "",
  ghiChuTrungDon: "",
  baoCaoBanGiamDocText: "",
  ngayGiaoDonViGiaiQuyet: "",
  ghiChuKhac: "",
  chuyenTuDonVi: "",
  chuyenDenDonVi: "",
  sinhNamNguoiToGiac: "",
  dieuTraVien: "",
  legacyExtra: {},
};
