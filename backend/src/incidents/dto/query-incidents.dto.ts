import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncidentStatus } from '@prisma/client';

export class QueryIncidentsDto {
  // Tìm kiếm tổng hợp: mã, tên, tên ĐTV
  @IsOptional()
  @IsString()
  search?: string;

  // Lọc theo trạng thái
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  // Lọc theo điều tra viên (AC-01)
  @IsOptional()
  @IsString()
  investigatorId?: string;

  // Lọc theo đơn vị
  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  // Lọc theo quá hạn
  @IsOptional()
  @IsString()
  overdue?: string; // "true" to filter overdue incidents

  // Lọc theo quận/huyện
  @IsOptional()
  @IsString()
  districtId?: string;

  // Lọc theo phường/xã
  @IsOptional()
  @IsString()
  wardId?: string;

  // BCA phase filter (server-side resolve via PHASE_STATUSES)
  @IsOptional()
  @IsString()
  phase?: string; // "tiep-nhan" | "xac-minh" | "ket-qua" | "tam-dinh-chi"

  // New filters for VuViec workflow
  @IsOptional()
  @IsString()
  loaiDonVu?: string;

  @IsOptional()
  @IsString()
  benVu?: string;

  @IsOptional()
  @IsString()
  tinhTrangHoSo?: string;

  @IsOptional()
  @IsString()
  tinhTrangThoiHieu?: string;

  @IsOptional()
  @IsString()
  canBoNhapId?: string;

  @IsOptional()
  @IsDateString()
  fromDateRange?: string; // Ngày đề xuất từ

  @IsOptional()
  @IsDateString()
  toDateRange?: string; // Ngày đề xuất đến

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
