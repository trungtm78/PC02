import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';
import { BANDS, RECORD_KINDS } from '../../contract/processing-codes';
import type { Band } from '../../engine/types';
import { WORK_ROLES, type WorkRole } from '../band-conditions';

const MAX_ID = 200;
export const TRACKING_MAX_PAGE_SIZE = 100;
export const TRACKING_DEFAULT_PAGE_SIZE = 20;

const asBoolean = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);

/** The filters the cards and the list share. Shapes only: anything else is the service's to judge. */
export class TrackingQueryDto {
  /**
   * The instant the colours are judged at (ISO 8601 with a time zone). Left out, the server uses its clock and SAYS which
   * instant that was; the screen passes it back when it opens the list of a card, so the two agree.
   */
  @IsOptional() @IsNgayThat() @MaxLength(40) asOf?: string;
  /** Only the work this person answers for: named on it, or heading the unit when nobody is named. */
  @IsOptional() @Transform(asBoolean) @IsBoolean() mine?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_ID) teamId?: string;
  @IsOptional() @IsIn([...RECORD_KINDS]) kind?: (typeof RECORD_KINDS)[number];
  /** The part the unit plays in the step: MAIN (left out), CHECK or COORDINATE. */
  @IsOptional() @IsIn([...WORK_ROLES]) role?: WorkRole;
  /** Only steps started in this period. A bare day (YYYY-MM-DD) is that civil day in Vietnam. */
  @IsOptional() @IsNgayThat() @MaxLength(40) from?: string;
  @IsOptional() @IsNgayThat() @MaxLength(40) to?: string;
}

/** The filters of the backlog table and of its export. `asOf`, `kind`, `role`, `from`, `to` mean what they mean on the list. */
export class BacklogQueryDto {
  @IsOptional() @IsNgayThat() @MaxLength(40) asOf?: string;
  @IsOptional() @IsIn([...RECORD_KINDS]) kind?: (typeof RECORD_KINDS)[number];
  @IsOptional() @IsIn([...WORK_ROLES]) role?: WorkRole;
  @IsOptional() @IsNgayThat() @MaxLength(40) from?: string;
  @IsOptional() @IsNgayThat() @MaxLength(40) to?: string;
}

/** The period (by `doneAt`) and the kind of the on-time report. */
export class OnTimeQueryDto extends BacklogQueryDto {}

export class TrackingItemsQueryDto extends TrackingQueryDto {
  /**
   * The card (or the cell of the backlog table) that was clicked. Left out: every colour, which is everything but NONE.
   * NONE: the work not yet near its deadline.
   */
  @IsOptional() @IsIn([...BANDS]) band?: Band;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(TRACKING_MAX_PAGE_SIZE) pageSize?: number;
}
