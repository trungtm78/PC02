import { IsInt, Min, Max, IsArray, ArrayMinSize, ArrayMaxSize, IsEnum } from 'class-validator';

export enum ReminderChannelDto {
  FCM = 'FCM',
  EMAIL = 'EMAIL',
}

export class CreateReminderDto {
  /**
   * Minutes before the event start. Bounded 1 minute → 30 days (43200 min).
   * Common presets: 15 (15p), 60 (1h), 1440 (1d), 10080 (1w).
   */
  @IsInt()
  @Min(1)
  @Max(43200)
  minutesBefore!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsEnum(ReminderChannelDto, { each: true })
  channels!: ReminderChannelDto[];
}
