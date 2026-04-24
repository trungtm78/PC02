import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { CaseStatus, CapDoToiPham } from '@prisma/client';

export { CaseStatus, CapDoToiPham };

export class CreateCaseDto {
  @IsString()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  crime?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  subjectsCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Mức độ tội phạm (BLHS 2015 Điều 9) — dùng cho KPI-4
  @IsOptional()
  @IsEnum(CapDoToiPham, {
    message: 'capDoToiPham phải là IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG hoặc DAC_BIET_NGHIEM_TRONG',
  })
  capDoToiPham?: CapDoToiPham;

  // Ngày quyết định khởi tố vụ án
  @IsOptional()
  @IsDateString()
  ngayKhoiTo?: string;
}
