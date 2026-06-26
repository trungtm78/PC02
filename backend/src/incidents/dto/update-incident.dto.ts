import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LoaiNguonTin, LyDoKhongKhoiTo, NguonPhatTin, PhuongThucTiepNhan } from '@prisma/client';
import { IsNguonPhatTinMatchLoaiDonVu } from '../../common/validators/nguon-phat-tin-match.validator';

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
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsDateString()
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
  @IsEnum(LoaiNguonTin, { message: 'loaiDonVu phải là TO_GIAC, TIN_BAO hoặc KIEN_NGHI_KHOI_TO' })
  loaiDonVu?: LoaiNguonTin;

  // v0.31.0.0 — cùng pattern với create-dto.
  @IsOptional()
  @IsEnum(NguonPhatTin, { message: 'nguonPhatTin không hợp lệ (Đ.144 BLTTHS)' })
  @IsNguonPhatTinMatchLoaiDonVu()
  nguonPhatTin?: NguonPhatTin;

  @IsOptional()
  @IsEnum(PhuongThucTiepNhan, {
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
  @IsDateString()
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
  @IsDateString()
  ngayQuyetDinh?: string;

  @IsOptional()
  @IsEnum(LyDoKhongKhoiTo, {
    message: 'lyDoKhongKhoiTo phải là một trong 7 căn cứ theo Điều 157 BLTTHS 2015',
  })
  lyDoKhongKhoiTo?: LyDoKhongKhoiTo;

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
  @IsDateString()
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
  @IsDateString()
  ngayTamDinhChiVV?: string;

  @IsOptional()
  @IsString()
  soQuyetDinhPhucHoiVV?: string;

  @IsOptional()
  @IsDateString()
  ngayPhucHoiVV?: string;

  // Field-parity tab "Vụ việc TĐC" form cũ (old: ngay_thang_nam_het_thoi_hieu_vu_viec)
  @IsOptional()
  @IsDateString()
  ngayHetThoiHieuVV?: string;
}
