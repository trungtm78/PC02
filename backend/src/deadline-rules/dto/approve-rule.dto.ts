import { IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';

/**
 * ApproveRuleDto — checker confirms a submitted version.
 *
 * `effectiveFrom` overrides the proposer's suggested date if provided; otherwise
 * the version's existing `effectiveFrom` (set at propose time) is used. Server
 * clamps to [now - 30d, now + 2y].
 *
 * If effectiveFrom <= now → status becomes 'active' immediately and previous
 * active version is superseded in the same transaction.
 * If effectiveFrom > now → status becomes 'approved'; the activator cron promotes
 * it when the date is reached.
 */
export class ApproveRuleDto {
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
