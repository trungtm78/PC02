import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ConclusionStatus } from '@prisma/client';

export class CreateConclusionDto {
  @IsString()
  caseId: string;

  @IsString()
  type: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  approvedById?: string;

  @IsOptional()
  @IsEnum(ConclusionStatus)
  status?: ConclusionStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
