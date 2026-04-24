import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LoaiNguonTin, LyDoKhongKhoiTo } from '@prisma/client';

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

  @IsOptional()
  @IsString()
  tinhTrangHoSo?: string;

  @IsOptional()
  @IsString()
  tinhTrangThoiHieu?: string;

  @IsOptional()
  @IsString()
  nguoiQuyetDinh?: string;
}
