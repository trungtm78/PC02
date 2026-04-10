import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProposalStatus } from '@prisma/client';

export class CreateProposalDto {
  @IsString()
  proposalNumber: string;

  @IsOptional()
  @IsString()
  relatedCaseId?: string;

  @IsOptional()
  @IsString()
  caseType?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

  @IsOptional()
  @IsString()
  sentDate?: string;

  @IsOptional()
  @IsString()
  response?: string;

  @IsOptional()
  @IsString()
  responseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
