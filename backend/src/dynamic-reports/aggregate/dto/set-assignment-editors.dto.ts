import { IsArray, IsNotEmpty, IsString } from 'class-validator';

/** S30 — đổi người nhập của một tổ trong kỳ đang chạy (D09: bắt buộc lý do). An empty list is refused by the service with a code. */
export class SetAssignmentEditorsDto {
  @IsArray()
  @IsString({ each: true })
  editorUserIds!: string[];

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
