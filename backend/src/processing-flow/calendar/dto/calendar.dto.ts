import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import type { CalendarDayKind } from '../../engine/types';

/**
 * Shapes only. Whether the days make a calendar (dates of that year, known kinds, a week with a working day) is judged
 * by the service, which answers with a code; the bounds here only keep an oversized or mistyped body out.
 */

/** What the writer looked at: which row of the year, at which revision. */
export class CalendarYearExpectationDto {
  @IsString() @MaxLength(200) id!: string;
  @IsInt() @Min(1) revision!: number;
}

export class CalendarDayDto {
  @IsString() @MaxLength(10) date!: string;
  @IsString() @MaxLength(20) kind!: CalendarDayKind;
  @IsOptional() @IsString() @MaxLength(1_000) label?: string | null;
}

/** ALL the exceptions of the year: what is not listed is removed. */
export class SaveCalendarYearDto {
  @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) weekendDays!: number[];

  @IsArray() @ArrayMaxSize(366) @ValidateNested({ each: true }) @Type(() => CalendarDayDto) days!: CalendarDayDto[];

  @IsOptional() @IsString() @MaxLength(4_000) note?: string | null;

  /** Must be SENT: the row and revision looked at, or `null` for "this year has no row yet". */
  @ValidateIf((body: SaveCalendarYearDto) => body.expected !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CalendarYearExpectationDto)
  expected!: CalendarYearExpectationDto | null;
}

/** Confirming a year and its way back: the row and revision looked at. */
export class CalendarYearActionDto {
  @IsDefined() @IsObject() @ValidateNested() @Type(() => CalendarYearExpectationDto) expected!: CalendarYearExpectationDto;
}
