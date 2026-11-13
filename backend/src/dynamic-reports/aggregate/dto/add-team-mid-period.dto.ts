import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** S30 — thêm tổ vào kỳ đang mở (D09: bắt buộc lý do + xác nhận tác động lên mẫu số). */
export class AddTeamMidPeriodDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  /** Who types for the team. Omitted: the editors the report's configuration names for it, if it names any. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editorUserIds?: string[];
}
