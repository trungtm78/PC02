import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * v0.32.0.0: body DTO cho POST /cases/:id/restore.
 * Mirror DeleteCaseDto pattern — reason 10-500 ký tự bắt buộc cho audit trail.
 *
 * UAT Round 1: Transform trim + IsNotEmpty để reject empty/whitespace.
 */
export class RestoreCaseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do khôi phục phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do khôi phục bắt buộc' })
  @MinLength(10, { message: 'Lý do khôi phục phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do khôi phục không được vượt quá 500 ký tự' })
  reason: string;
}
