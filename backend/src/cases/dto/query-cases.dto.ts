import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CaseStatus } from '@prisma/client';

export class QueryCasesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

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
  overdue?: string; // "true" to filter overdue cases

  // Lọc theo quận/huyện (thông qua subjects)
  @IsOptional()
  @IsString()
  districtId?: string;

  // Lọc theo phường/xã (thông qua subjects)
  @IsOptional()
  @IsString()
  wardId?: string;

  // Sort
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @Transform(({ value }) => value === 'asc' ? 'asc' : 'desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
