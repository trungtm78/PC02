import { IsNotEmpty, IsString } from 'class-validator';

/** S30 — miễn nộp một tổ trong kỳ đang mở (D09: bắt buộc lý do + xác nhận tác động lên mẫu số). */
export class ExemptTeamMidPeriodDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
