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
import { CaseStatus } from '@prisma/client';

export { CaseStatus };

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
}
