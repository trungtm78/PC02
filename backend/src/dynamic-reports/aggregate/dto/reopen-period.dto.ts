import { IsNotEmpty, IsString } from 'class-validator';

/** S38 — admin reopens a FINALIZED period (BRD: thu hồi/mở chốt luôn cần lý do). */
export class ReopenPeriodDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
