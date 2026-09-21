import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsEdtfNgayThat } from '../../common/validators/is-edtf-ngay-that.validator';
import { LoaiNguonTin, LyDoKhongKhoiTo, LyDoTamDinhChiVuViec, NguonPhatTin, PhuongThucTiepNhan } from '@prisma/client';
import { IsNguonPhatTinMatchLoaiDonVu } from '../../common/validators/nguon-phat-tin-match.validator';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Tên vụ việc phải có ít nhất 5 ký tự' })
  @MaxLength(255, { message: 'Tên vụ việc không được vượt quá 255 ký tự' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  incidentType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNgayThat()
  fromDate?: string;

  @IsOptional()
  @IsNgayThat()
  toDate?: string;

  @IsOptional()
  @IsNgayThat()
  deadline?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Status removed — use PATCH /:id/status instead

  @IsOptional()
  @IsString()
  doiTuongCaNhan?: string;

  @IsOptional()
  @IsString()
  doiTuongToChuc?: string;

  @IsOptional()
  @IsCatalogValue('LOAI_NGUON_TIN', { message: 'loaiDonVu phải là TO_GIAC, TIN_BAO hoặc KIEN_NGHI_KHOI_TO' })
  loaiDonVu?: LoaiNguonTin;

  // v0.31.0.0 — cùng pattern với create-dto (catalog + cascade validator).
  @IsOptional()
  @IsCatalogValue('NGUON_PHAT_TIN', { message: 'nguonPhatTin không hợp lệ (Đ.144 BLTTHS)' })
  @IsNguonPhatTinMatchLoaiDonVu()
  nguonPhatTin?: NguonPhatTin;

  @IsOptional()
  @IsCatalogValue('PHUONG_THUC_TIEP_NHAN', {
    message: 'phuongThucTiepNhan phải là một trong 5 phương thức TT 28/2020/TT-BCA Đ.6',
  })
  phuongThucTiepNhan?: PhuongThucTiepNhan;

  @IsOptional()
  @IsString()
  benVu?: string;

  @IsOptional()
  @IsString()
  donViGiaiQuyet?: string;

  @IsOptional()
  @IsNgayThat()
  ngayDeXuat?: string;

  @IsOptional()
  @IsString()
  ketQuaXuLy?: string;

  // PR 5 v0.38.4.0: Wireframe 5 — Loại kết quả (chuẩn hóa enum string) + Căn cứ khởi tố Đ.143
  @IsOptional()
  @IsString()
  loaiKetQua?: string;

  @IsOptional()
  @IsString()
  canCuKhoiToCode?: string;

  @IsOptional()
  @IsString()
  tinhTrangHoSo?: string;

  @IsOptional()
  @IsString()
  tinhTrangThoiHieu?: string;

  @IsOptional()
  @IsString()
  nguoiQuyetDinh?: string;

  @IsOptional()
  @IsString()
  canBoNhapId?: string;

  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @IsString()
  soQuyetDinh?: string;

  @IsOptional()
  @IsNgayThat()
  ngayQuyetDinh?: string;

  @IsOptional()
  @IsArray()
  @IsCatalogValue('LY_DO_KHONG_KHOI_TO', {
    each: true,
    message: 'lyDoKhongKhoiTo phải là căn cứ thuộc danh mục theo Điều 157 BLTTHS 2015',
  })
  lyDoKhongKhoiTo?: LyDoKhongKhoiTo[];

  // PR-8 MULTI: căn cứ tạm đình chỉ vụ việc (Đ.148) — chọn nhiều
  @IsOptional()
  @IsArray()
  @IsCatalogValue('LY_DO_TAM_DINH_CHI_VU_VIEC', { each: true })
  lyDoTamDinhChiVuViec?: LyDoTamDinhChiVuViec[];

  @IsOptional()
  @IsString()
  lyDoTamDinhChi?: string;

  @IsOptional()
  @IsString()
  diaChiXayRa?: string;

  @IsOptional()
  @IsString()
  sdtNguoiToGiac?: string;

  @IsOptional()
  @IsString()
  diaChiNguoiToGiac?: string;

  @IsOptional()
  @IsString()
  cmndNguoiToGiac?: string;

  @IsOptional()
  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;

  // Field-parity hệ thống cũ (giai đoạn nguồn tin) — phải khớp CreateIncidentDto
  @IsOptional()
  @IsString()
  soQDPhanCongNguonTin?: string;

  @IsOptional()
  @IsNgayThat()
  ngayQDPhanCongNguonTin?: string;

  @IsOptional()
  @IsString()
  canCuKhongKhoiTo?: string;

  @IsOptional()
  @IsString()
  canCuTamDinhChi?: string;

  @IsOptional()
  @IsString()
  phanLoaiDanSuText?: string;

  // Field-parity TĐC vụ việc — PHẢI khớp CreateIncidentDto + whitelist update (incidents.service).
  // Trước đây thiếu ở UpdateIncidentDto → forbidNonWhitelisted 400 khi EDIT (nhập-không-lưu).
  @IsOptional()
  @IsString()
  soQuyetDinhTamDinhChiVV?: string;

  @IsOptional()
  @IsNgayThat()
  ngayTamDinhChiVV?: string;

  @IsOptional()
  @IsString()
  soQuyetDinhPhucHoiVV?: string;

  @IsOptional()
  @IsNgayThat()
  ngayPhucHoiVV?: string;

  // Field-parity tab "Vụ việc TĐC" form cũ (old: ngay_thang_nam_het_thoi_hieu_vu_viec)
  @IsOptional()
  @IsNgayThat()
  ngayHetThoiHieuVV?: string;

  // Field khắc phục TĐC + CNC — form GỬI khi update, có trong whitelist service nhưng trước thiếu DTO → 400.
  @IsOptional()
  @IsString()
  tienDoKhacPhucTDC?: string;

  @IsOptional()
  @IsString()
  tdcKhacPhucLyDoBienPhap?: string;

  @IsOptional()
  @IsString()
  tdcKhacPhucBienBan?: string;

  @IsOptional()
  @IsBoolean()
  laCongNgheCaoVV?: boolean;

  // PR-6 — QĐ không khởi tố riêng + cờ xác định tạm dừng (parity Vụ việc)
  @IsOptional()
  @IsString()
  soQDKhongKhoiTo?: string;

  @IsOptional()
  @IsNgayThat()
  ngayQDKhongKhoiTo?: string;

  @IsOptional()
  @IsBoolean()
  xacDinhVuViecTamDung?: boolean;

  // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity): field intake hệ cũ Vụ việc ──
  @IsOptional() @IsString() nhanXet?: string;
  @IsOptional() @IsNgayThat() ngayTiepNhanNguonTin?: string;
  @IsOptional() @IsString() loaiThongTin?: string;
  @IsOptional() @IsNgayThat() ngayVietDon?: string;
  /** Ngày viết đơn thiếu thành phần (EDTF) — cùng quy ước Đơn thư, thêm 21/09/2026. */
  @IsOptional() @IsEdtfNgayThat() ngayVietDonEdtf?: string;
  /**
   * Ngày viết đơn GHI NGUYÊN VĂN như trên giấy. KHÔNG kiểm hình dạng, có chủ ý: đặt luật nào
   * ở đây là chặn lại đúng thứ cột này sinh ra để chứa (hồ sơ gộp nhiều đơn, "Không ghi ngày").
   */
  @IsOptional() @MaxLength(1000) @IsString() ngayVietDonChu?: string;
  @IsOptional() @IsString() ghiChuTrungDon?: string;
  @IsOptional() @IsBoolean() baoCaoBanGiamDoc?: boolean;
  @IsOptional() @IsNgayThat() ngayGiaoDonViGiaiQuyet?: string;
  @IsOptional() @IsString() toiDanhBanDau?: string;
  @IsOptional() @IsString() soPhieuChuyen?: string;
  @IsOptional() @IsNgayThat() ngayPhieuChuyen?: string;
  @IsOptional() @IsString() doVatTaiLieuKemTheo?: string;
  @IsOptional() @IsString() phanLoaiToiPhamLinhVuc?: string;
  @IsOptional() @IsString() phanLoaiHoSoNoiBo?: string;
  @IsOptional() @IsString() lanhDaoToTung?: string;
  @IsOptional() @IsString() dieuTraVien?: string;
  @IsOptional() @IsString() dieuTraVienPhuongXa?: string;
  @IsOptional() @IsString() noiCapCccd?: string;
  @IsOptional() @IsNgayThat() ngayCapCccd?: string;
  @IsOptional() @IsString() deXuat?: string;
  @IsOptional() @IsString() yeuCauBoSung?: string;
  @IsOptional() @IsString() ghiChuKhac?: string;

  // ── Ba cột hệ cũ thêm 27/08/2026 ────────────────────────────────────────────────────
  // Thiếu khai ở đây thì `forbidNonWhitelisted` đá CẢ lời gọi bằng 400, tức không tạo/sửa
  // được vụ việc nào — kể cả vụ không đụng gì tới ba ô này. Đúng sự cố `sttCu` (#259).
  @IsOptional() @IsString() crimeChinhId?: string;
  @IsOptional() @IsString() phanLoaiNguonTinBanDau?: string;
  @IsOptional() @IsString() baoCaoBanGiamDocText?: string;

  // ── Ba ô hệ cũ mà form 10 tab (27/08/2026) bắt đầu gửi lên ────────────────────────────
  // Cột đã có sẵn trong lược đồ và bộ di trú vẫn đổ vào, chỉ là form chưa từng hiện chúng.
  // Thiếu khai ở đây thì `forbidNonWhitelisted` đá CẢ lời gọi bằng 400.
  @IsOptional() @IsString() chuyenTuDonVi?: string;
  @IsOptional() @IsString() chuyenDenDonVi?: string;
  @IsOptional() @IsString() sinhNamNguoiToGiac?: string;

  // Field hệ cũ dạng cấu trúc (dynamic legacy fields) — MERGE ở service, không REPLACE.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
