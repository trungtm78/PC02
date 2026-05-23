import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * v0.31.0.2: body DTO cho DELETE /cases/:id.
 * Mirror DeleteIncidentDto pattern — reason 10-500 ký tự bắt buộc cho audit trail.
 *
 * UAT Round 1 (TC-142, TC-143): Transform trim chạy trước IsNotEmpty để reject
 * empty + whitespace-only payload trước khi MinLength chạy.
 */
export class DeleteCaseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do xóa phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do xóa bắt buộc' })
  @MinLength(10, { message: 'Lý do xóa phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do xóa không được vượt quá 500 ký tự' })
  reason: string;
}
