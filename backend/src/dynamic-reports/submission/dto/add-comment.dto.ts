import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** S37 (PR9 slice 2) — `fieldKey` omitted = ghi chú cho cả bản nộp. */
export class AddCommentDto {
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
