import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProposalStatus } from '@prisma/client';

export class CreateProposalDto {
  // UAT TC-582 (Round 1): Transform trim + IsNotEmpty reject empty/whitespace.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Số quyết định bắt buộc' })
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
