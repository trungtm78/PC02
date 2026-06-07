import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Thống kê mở rộng (hybrid) — 1-1 với Case, lưu bảng case_statistics. Tất cả optional.
export class CaseStatisticDto {
  // Hồ sơ nghiệp vụ
  @IsOptional() @IsString() soDangKyHoSo?: string;
  @IsOptional() @IsDateString() ngayDangKyHoSo?: string;
  @IsOptional() @IsString() hoSoLuu?: string;
  @IsOptional() @IsDateString() ngayNopLuuHoSo?: string;
  @IsOptional() @IsString() donViBaoQuanHoSo?: string;

  // Ghi âm, ghi hình
  @IsOptional() @IsBoolean() coGhiAmGhiHinh?: boolean;
  @IsOptional() @IsInt() @Min(0) tongSoBienBanGhiLoiKhai?: number;
  @IsOptional() @IsInt() @Min(0) soBienBanGhiLoiKhaiCoGhiAm?: number;
  @IsOptional() @IsBoolean() laVuAnGhiAmGhiHinh?: boolean;
  @IsOptional() @IsInt() @Min(0) tongSoBienBanHoiCung?: number;
  @IsOptional() @IsInt() @Min(0) tongSoBienBanHoiCungCoGhiAm?: number;
  @IsOptional() @IsInt() @Min(0) soBiCanCoGhiAm?: number;
  @IsOptional() @IsBoolean() vksYeuCauGhiAm?: boolean;
  @IsOptional() @IsInt() @Min(0) soBiCanVksYeuCauGhiAm?: number;

  // VPHC
  @IsOptional() @IsBoolean() coVPHC?: boolean;
  @IsOptional() @IsInt() @Min(0) soDoiTuongVPHC?: number;
  @IsOptional() @IsInt() @Min(0) soNguoiBiPhatTien?: number;
  @IsOptional() @IsNumber() @Min(0) tongTienPhatHanhChinh?: number;

  // Đối tượng / vũ khí / băng nhóm
  @IsOptional() @IsInt() @Min(0) soDoiTuongDaBat?: number;
  @IsOptional() @IsInt() @Min(0) soDoiTuongBiBatVuAnKhac?: number;
  @IsOptional() @IsInt() @Min(0) dieuTraMoRong?: number;
  @IsOptional() @IsString() suDungVuKhiNong?: string;
  @IsOptional() @IsBoolean() coBangNhom?: boolean;
  @IsOptional() @IsInt() @Min(0) soBangNhomBatDuoc?: number;
  @IsOptional() @IsInt() @Min(0) soSungThuHoi?: number;
  @IsOptional() @IsInt() @Min(0) soThuocNoThuHoi?: number;
  @IsOptional() @IsInt() @Min(0) soDoiTuongSuuTraHiemNghi?: number;

  // Field-parity hệ thống cũ — bị hại, thiệt hại, xét xử
  @IsOptional() @IsInt() @Min(0) soLuongBiHai?: number;
  @IsOptional() @IsInt() @Min(0) soNguoiBiThuong?: number;
  @IsOptional() @IsInt() @Min(0) soLuongNguoiChet?: number;
  @IsOptional() @IsNumber() @Min(0) soTienBiThietHai?: number;
  @IsOptional() @IsNumber() @Min(0) soTienThuHoi?: number;
  @IsOptional() @IsBoolean() vuAnDaDuocXetXu?: boolean;

  // Mốc thời gian thống kê
  @IsOptional() @IsDateString() ngayThongKe?: string;
  @IsOptional() @IsDateString() ngayPhanCongGiaiQuyetToGiac?: string;
  @IsOptional() @IsDateString() ngayTiepNhanTin?: string;
  @IsOptional() @IsDateString() ngayDauThu?: string;
  @IsOptional() @IsDateString() ngayPhamToiQuaTang?: string;
  @IsOptional() @IsDateString() ngayBatKhanCap?: string;
  @IsOptional() @IsDateString() ngayPhatHienDauHieu?: string;
}

// Các field ngày trong CaseStatisticDto — dùng để convert string → Date ở service.
export const CASE_STATISTIC_DATE_FIELDS = [
  'ngayDangKyHoSo',
  'ngayNopLuuHoSo',
  'ngayThongKe',
  'ngayPhanCongGiaiQuyetToGiac',
  'ngayTiepNhanTin',
  'ngayDauThu',
  'ngayPhamToiQuaTang',
  'ngayBatKhanCap',
  'ngayPhatHienDauHieu',
] as const;
