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

export class CreateIncidentDto {
  // Tên vụ việc — bắt buộc, 5–255 ký tự (Table 2.2.A)
  @IsString()
  @MinLength(5, { message: 'Tên vụ việc phải có ít nhất 5 ký tự' })
  @MaxLength(255, { message: 'Tên vụ việc không được vượt quá 255 ký tự' })
  name: string;

  // Loại vụ việc — tuỳ chọn
  @IsOptional()
  @IsString()
  @MaxLength(100)
  incidentType?: string;

  // Mô tả
  @IsOptional()
  @IsString()
  description?: string;

  // Từ ngày (fromDate) — EC-05: fromDate <= toDate
  @IsOptional()
  @IsDateString({}, { message: 'Từ ngày không đúng định dạng' })
  fromDate?: string;

  // Đến ngày (toDate)
  @IsOptional()
  @IsDateString({}, { message: 'Đến ngày không đúng định dạng' })
  toDate?: string;

  // Hạn xử lý
  @IsOptional()
  @IsDateString({}, { message: 'Hạn xử lý không đúng định dạng' })
  deadline?: string;

  // Đơn vị thụ lý (ID)
  @IsOptional()
  @IsString()
  unitId?: string;

  // Điều tra viên thụ lý (ID)
  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Nguồn từ đơn thư
  @IsOptional()
  @IsString()
  sourcePetitionId?: string;

  // New fields for full VuViec workflow
  @IsOptional()
  @IsString()
  doiTuongCaNhan?: string;

  @IsOptional()
  @IsString()
  doiTuongToChuc?: string;

  @IsOptional()
  @IsEnum(LoaiNguonTin, { message: 'loaiDonVu phải là TO_GIAC, TIN_BAO hoặc KIEN_NGHI_KHOI_TO' })
  loaiDonVu?: LoaiNguonTin;

  // v0.31.0.0 — Nguồn phát tin (Đ.144 BLTTHS): cascading từ loaiDonVu.
  // Custom validator enforce mapping FE-side và BE-side đồng bộ.
  @IsOptional()
  @IsEnum(NguonPhatTin, { message: 'nguonPhatTin không hợp lệ (Đ.144 BLTTHS)' })
  @IsNguonPhatTinMatchLoaiDonVu()
  nguonPhatTin?: NguonPhatTin;

  // v0.31.0.0 — Phương thức tiếp nhận (TT 28/2020/TT-BCA Đ.6): 5 phương thức.
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
  @IsDateString({}, { message: 'Ngày đề xuất không đúng định dạng' })
  ngayDeXuat?: string;

  @IsOptional()
  @IsString()
  canBoNhapId?: string;

  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @IsString()
  linkedPetitionId?: string;

  // Nghiệp vụ BLTTHS
  @IsOptional()
  @IsString()
  soQuyetDinh?: string;

  @IsOptional()
  @IsDateString()
  ngayQuyetDinh?: string;

  // Field-parity hệ thống cũ (giai đoạn nguồn tin)
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

  // Kết quả + tình trạng (accepted on create so the form can set them
  // when a case is entered retrospectively with results already known)
  @IsOptional()
  @IsString()
  ketQuaXuLy?: string;

  // PR 5 v0.38.4.0: Wireframe 5 — Loại kết quả chuẩn hóa + Căn cứ khởi tố Đ.143
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

  // Field-parity hệ thống cũ — TĐC tracking + tiến độ khắc phục
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

  @IsOptional()
  laCongNgheCaoVV?: boolean;
}
