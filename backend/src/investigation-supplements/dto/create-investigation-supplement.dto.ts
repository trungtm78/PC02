import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateInvestigationSupplementDto {
  @IsString()
  caseId: string;

  @IsString()
  type: string;

  @IsString()
  decisionNumber: string;

  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
