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
import { DEADLINE_RULE_KEYS } from '../constants/deadline-rule-keys.constants';

export const DOCUMENT_TYPES = ['TT', 'NĐ', 'CV', 'QĐ', 'BLTTHS', 'Khác'] as const;
export const DOCUMENT_ISSUERS = ['BCA', 'VKSNDTC', 'TANDTC', 'Chính phủ', 'Quốc hội', 'Khác'] as const;

/**
 * ProposeRuleDto — creates a new DeadlineRuleVersion in 'draft' status.
 *
 * `ruleKey` must match an existing deadline rule key. Value range is permissive
 * here (1..3650) so policy-specific limits (e.g. SO_LAN_GIA_HAN_TOI_DA usually 2)
 * are enforced at approval time / by review process, not runtime DTO.
 */
export class ProposeRuleDto {
  @IsString()
  @IsIn(DEADLINE_RULE_KEYS as unknown as string[])
  ruleKey!: string;

  @IsInt()
  @Min(1)
  @Max(3650) // 10 years upper bound — defensive only; reviewers gate semantics
  value!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  legalBasis!: string;

  @IsString()
  @IsIn(DOCUMENT_TYPES as unknown as string[])
  documentType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documentNumber!: string;

  @IsString()
  @IsIn(DOCUMENT_ISSUERS as unknown as string[])
  documentIssuer!: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsString()
  attachmentId?: string;

  @IsString()
  @MinLength(20, { message: 'Lý do phải có ít nhất 20 ký tự để đảm bảo audit trail' })
  @MaxLength(2000)
  reason!: string;

  /**
   * Optional — when the proposer wants to schedule activation for a future date.
   * Clamped: cannot be more than 2 years in the future, cannot be more than
   * 30 days in the past (allows immediate activation with same-day backdate).
   * Validated in service to use server clock not client clock.
   */
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
