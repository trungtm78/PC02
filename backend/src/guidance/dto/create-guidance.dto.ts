import { IsString, IsOptional, IsEnum } from 'class-validator';
import { GuidanceStatus } from '@prisma/client';

export class CreateGuidanceDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsString()
  guidedPerson: string;

  @IsOptional()
  @IsString()
  guidedPersonPhone?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  guidanceContent: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(GuidanceStatus)
  status?: GuidanceStatus;
}
