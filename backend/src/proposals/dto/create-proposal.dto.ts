import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';
import { Transform } from 'class-transformer';
import { ProposalStatus } from '@prisma/client';

export class CreateProposalDto {
  // Số quyết định — optional: engine sinh khi không cung cấp
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  proposalNumber?: string;

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
  @IsNgayThat()
  sentDate?: string;

  @IsOptional()
  @IsString()
  response?: string;

  @IsOptional()
  @IsNgayThat()
  responseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
