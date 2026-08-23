import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { IsRealDateString } from '../../common/validators/is-real-date-string.validator';

// Thống kê mở rộng (hybrid) — 1-1 với Case, lưu bảng case_statistics. Tất cả optional.
export class CaseStatisticDto {
  // Hồ sơ nghiệp vụ
  @IsOptional() @IsString() soDangKyHoSo?: string;
  @IsOptional() @IsRealDateString() ngayDangKyHoSo?: string;
  @IsOptional() @IsString() hoSoLuu?: string;
  @IsOptional() @IsRealDateString() ngayNopLuuHoSo?: string;
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
  @IsOptional() @IsInt() @Min(0) soDoiTuong?: number; // PR-7: tổng số đối tượng (old so_doi_tuong)
  @IsOptional() @IsInt() @Min(0) soDoiTuongDaBat?: number;
  @IsOptional() @IsInt() @Min(0) soDoiTuongBiBatVuAnKhac?: number;
  @IsOptional() @IsInt() @Min(0) dieuTraMoRong?: number;
  @IsOptional() @IsString() suDungVuKhiNong?: string;
  @IsOptional() @IsBoolean() coBangNhom?: boolean;
  @IsOptional() @IsInt() @Min(0) soBangNhom?: number; // PR-7: số lượng băng nhóm (old co_bao_nhieu_bang_nhom)
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
  // PR-M2 (Codex P1#9): 3 cờ xét-xử RIÊNG — KHÔNG reuse vuAnDaDuocXetXu/coGhiAmGhiHinh (khác ngữ nghĩa).
  @IsOptional() @IsBoolean() ghiAmGhiHinhDaDuocXetXu?: boolean;
  @IsOptional() @IsBoolean() coSuDungKQGhiAmTrongXetXu?: boolean;
  @IsOptional() @IsBoolean() khongGAGHNhungToaYeuCau?: boolean;

  // Mốc thời gian thống kê
  @IsOptional() @IsRealDateString() ngayThongKe?: string;
  @IsOptional() @IsRealDateString() ngayPhanCongGiaiQuyetToGiac?: string;
  @IsOptional() @IsRealDateString() ngayTiepNhanTin?: string;
  @IsOptional() @IsRealDateString() ngayDauThu?: string;
  @IsOptional() @IsRealDateString() ngayPhamToiQuaTang?: string;
  @IsOptional() @IsRealDateString() ngayBatKhanCap?: string;
  @IsOptional() @IsRealDateString() ngayPhatHienDauHieu?: string;
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
