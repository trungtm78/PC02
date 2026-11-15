import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';
import { BANDS, RECORD_KINDS } from '../../contract/processing-codes';
import type { Band } from '../../engine/types';
import { WORK_ROLES, type WorkRole } from '../band-conditions';

const MAX_ID = 200;
export const TRACKING_MAX_PAGE_SIZE = 100;
export const TRACKING_DEFAULT_PAGE_SIZE = 20;

/** The shortest and the longest text the search box sends (after trimming). */
export const TRACKING_SEARCH_MIN = 2;
export const TRACKING_SEARCH_MAX = 100;
/** The one value of `awaiting`: the steps that wait for this person's decision. */
export const AWAITING_APPROVAL = 'approval';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
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
  /** The search box: a part of the record's code, or of the name next to it on the list. Trimmed; 2 to 100 characters. */
  @IsOptional() @Transform(trimmed) @IsString() @MinLength(TRACKING_SEARCH_MIN) @MaxLength(TRACKING_SEARCH_MAX) q?: string;
}

/** The filters of the backlog table and of its export. `asOf`, `kind`, `role`, `from`, `to` mean what they mean on the list. */
export class BacklogQueryDto {
  @IsOptional() @IsNgayThat() @MaxLength(40) asOf?: string;
  @IsOptional() @IsIn([...RECORD_KINDS]) kind?: (typeof RECORD_KINDS)[number];
  @IsOptional() @IsIn([...WORK_ROLES]) role?: WorkRole;
  @IsOptional() @IsNgayThat() @MaxLength(40) from?: string;
  @IsOptional() @IsNgayThat() @MaxLength(40) to?: string;
  /** The table rolled up to its top units, as the screen shows it with "Gộp lên tổ cha" on. */
  @IsOptional() @Transform(asBoolean) @IsBoolean() rollup?: boolean;
  /** Only this unit; with `rollup`, the unit and every unit under it. */
  @IsOptional() @IsString() @MaxLength(MAX_ID) teamId?: string;
}

/** The records behind one number of the column "no flow yet": one unit, one kind of record. */
export class UnappliedQueryDto {
  @IsIn([...RECORD_KINDS]) kind!: (typeof RECORD_KINDS)[number];
  @IsString() @MaxLength(MAX_ID) teamId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(TRACKING_MAX_PAGE_SIZE) pageSize?: number;
}

/** The period (by `doneAt`) and the kind of the on-time report. */
export class OnTimeQueryDto extends BacklogQueryDto {}

export class TrackingItemsQueryDto extends TrackingQueryDto {
  /**
   * The card (or the cell of the backlog table) that was clicked. Left out: every colour, which is everything but NONE.
   * NONE: the work not yet near its deadline.
   */
  @IsOptional() @IsIn([...BANDS]) band?: Band;
  /**
   * `approval`: the card "Chờ tôi duyệt" was clicked. The list is then the steps that wait for THIS person's decision
   * (`summary.awaitingMyApproval` counts the same rows) and `band` is not read.
   */
  @IsOptional() @IsIn([AWAITING_APPROVAL]) awaiting?: typeof AWAITING_APPROVAL;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(TRACKING_MAX_PAGE_SIZE) pageSize?: number;
}
