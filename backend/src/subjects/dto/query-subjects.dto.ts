import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubjectStatus, SubjectType } from '@prisma/client';

export class QuerySubjectsDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(SubjectStatus)
  @IsOptional()
  status?: SubjectStatus;

  @IsEnum(SubjectType)
  @IsOptional()
  type?: SubjectType;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  crimeId?: string;

  @IsString()
  @IsOptional()
  districtId?: string;

  @IsString()
  @IsOptional()
  wardId?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
