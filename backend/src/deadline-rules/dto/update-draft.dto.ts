import {
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { DOCUMENT_TYPES, DOCUMENT_ISSUERS } from './propose-rule.dto';

/**
 * UpdateDraftDto — edits an existing draft. All fields optional (proposer can
 * iterate). Server enforces status='draft' and proposer-only ownership.
 */
export class UpdateDraftDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  value?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  legalBasis?: string;

  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_TYPES as unknown as string[])
  documentType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(DOCUMENT_ISSUERS as unknown as string[])
  documentIssuer?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  attachmentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
