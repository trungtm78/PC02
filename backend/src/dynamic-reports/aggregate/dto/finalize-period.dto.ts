import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Closing a period with teams still outstanding needs the manager to say so. `acknowledgedBasis` is the very sentence the
 * server showed (UNAPPROVED_TEAMS), sent back; the server accepts it only if it is still what is true.
 */
export class FinalizePeriodDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  acknowledgedBasis?: string;
}
