import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';
import { RECORD_KINDS } from '../../contract/processing-codes';
import { TRACKED_BANDS, type TrackedBand } from '../band-conditions';

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
}

export class TrackingItemsQueryDto extends TrackingQueryDto {
  /** The card that was clicked. Left out: every colour. */
  @IsOptional() @IsIn([...TRACKED_BANDS]) band?: TrackedBand;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(TRACKING_MAX_PAGE_SIZE) pageSize?: number;
}
