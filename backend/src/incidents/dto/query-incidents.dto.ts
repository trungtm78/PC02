import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
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

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
