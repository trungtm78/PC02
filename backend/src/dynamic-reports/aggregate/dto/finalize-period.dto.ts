import { IsBoolean, IsOptional } from 'class-validator';

/** Closing a period with teams still outstanding needs the manager to say so; without it the server answers UNAPPROVED_TEAMS (409). */
export class FinalizePeriodDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeExcluded?: boolean;
}
