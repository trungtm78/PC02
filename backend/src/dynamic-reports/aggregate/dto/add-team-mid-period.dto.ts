import { IsNotEmpty, IsString } from 'class-validator';

/** S30 — thêm tổ vào kỳ đang mở (D09: bắt buộc lý do + xác nhận tác động lên mẫu số). */
export class AddTeamMidPeriodDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
