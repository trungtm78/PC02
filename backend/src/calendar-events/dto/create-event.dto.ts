import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  Min,
  Max,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export enum EventScopeDto {
  SYSTEM = 'SYSTEM',
  TEAM = 'TEAM',
  PERSONAL = 'PERSONAL',
}

/**
 * RRULE safety guard — these frequencies expand into too many occurrences
 * if unbounded. We require recurrenceEndDate when using them. YEARLY/MONTHLY/WEEKLY
 * are bounded enough to allow unlimited (capped at 500 iterations downstream).
 */
const UNBOUNDED_FREQ_FORBIDDEN = /FREQ=(DAILY|HOURLY|MINUTELY|SECONDLY)/i;

export class CreateEventDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  shortTitle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  description?: string;

  @IsDateString()
  startDate!: string; // ISO date YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsBoolean()
  allDay!: boolean;

  // HH:MM strings (must validate when !allDay)
  @ValidateIf((o) => !o.allDay)
  @IsString()
  @Matches(/^[0-2]\d:[0-5]\d$/, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ValidateIf((o) => !o.allDay)
  @IsOptional()
  @IsString()
  @Matches(/^[0-2]\d:[0-5]\d$/, { message: 'endTime must be HH:MM' })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  isOfficialDayOff?: boolean;

  @IsOptional()
  @IsString()
  lunarDate?: string;

  @IsString()
  categoryId!: string;

  @IsEnum(EventScopeDto)
  scope!: EventScopeDto;

  // Required when scope=TEAM. Service validates user is leader of this team.
  @ValidateIf((o) => o.scope === EventScopeDto.TEAM)
  @IsString()
  teamId?: string;

  // For PERSONAL scope, service forces userId = currentUser.id (ignores client value).

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  @Matches(/^[A-Z=,;:\-+0-9]+$/i, { message: 'recurrenceRule contains invalid characters' })
  recurrenceRule?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;
}

export function validateRecurrenceSafety(rule: string | undefined, endDate: string | undefined): void {
  if (!rule) return;
  if (UNBOUNDED_FREQ_FORBIDDEN.test(rule)) {
    if (!endDate && !/UNTIL=/i.test(rule) && !/COUNT=/i.test(rule)) {
      throw new Error(
        'Recurring events with FREQ=DAILY/HOURLY/MINUTELY/SECONDLY must specify recurrenceEndDate, UNTIL, or COUNT to bound the expansion.',
      );
    }
  }
}
