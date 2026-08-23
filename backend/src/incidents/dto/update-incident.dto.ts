import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsArray,
  IsObject,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LoaiNguonTin, LyDoKhongKhoiTo, LyDoTamDinhChiVuViec, NguonPhatTin, PhuongThucTiepNhan } from '@prisma/client';
import { IsNguonPhatTinMatchLoaiDonVu } from '../../common/validators/nguon-phat-tin-match.validator';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { IsRealDateString } from '../../common/validators/is-real-date-string.validator';

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
  @IsRealDateString()
  fromDate?: string;

  @IsOptional()
  @IsRealDateString()
  toDate?: string;

  @IsOptional()
  @IsRealDateString()
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
  @IsRealDateString()
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
  @IsRealDateString()
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
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;

  // Field-parity hệ thống cũ (giai đoạn nguồn tin) — phải khớp CreateIncidentDto
  @IsOptional()
  @IsString()
  soQDPhanCongNguonTin?: string;

  @IsOptional()
  @IsRealDateString()
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
  @IsRealDateString()
  ngayTamDinhChiVV?: string;

  @IsOptional()
  @IsString()
  soQuyetDinhPhucHoiVV?: string;

  @IsOptional()
  @IsRealDateString()
  ngayPhucHoiVV?: string;

  // Field-parity tab "Vụ việc TĐC" form cũ (old: ngay_thang_nam_het_thoi_hieu_vu_viec)
  @IsOptional()
  @IsRealDateString()
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
  @IsRealDateString()
  ngayQDKhongKhoiTo?: string;

  @IsOptional()
  @IsBoolean()
  xacDinhVuViecTamDung?: boolean;

  // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity): field intake hệ cũ Vụ việc ──
  @IsOptional() @IsString() nhanXet?: string;
  @IsOptional() @IsRealDateString() ngayTiepNhanNguonTin?: string;
  @IsOptional() @IsString() loaiThongTin?: string;
  @IsOptional() @IsRealDateString() ngayVietDon?: string;
  @IsOptional() @IsString() ghiChuTrungDon?: string;
  @IsOptional() @IsBoolean() baoCaoBanGiamDoc?: boolean;
  @IsOptional() @IsRealDateString() ngayGiaoDonViGiaiQuyet?: string;
  @IsOptional() @IsString() toiDanhBanDau?: string;
  @IsOptional() @IsString() soPhieuChuyen?: string;
  @IsOptional() @IsRealDateString() ngayPhieuChuyen?: string;
  @IsOptional() @IsString() doVatTaiLieuKemTheo?: string;
  @IsOptional() @IsString() phanLoaiToiPhamLinhVuc?: string;
  @IsOptional() @IsString() phanLoaiHoSoNoiBo?: string;
  @IsOptional() @IsString() lanhDaoToTung?: string;
  @IsOptional() @IsString() dieuTraVien?: string;
  @IsOptional() @IsString() dieuTraVienPhuongXa?: string;
  @IsOptional() @IsString() noiCapCccd?: string;
  @IsOptional() @IsRealDateString() ngayCapCccd?: string;
  @IsOptional() @IsString() deXuat?: string;
  @IsOptional() @IsString() yeuCauBoSung?: string;
  @IsOptional() @IsString() ghiChuKhac?: string;

  // Field hệ cũ dạng cấu trúc (dynamic legacy fields) — MERGE ở service, không REPLACE.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
