import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for POST /evidences/:id/restore.
 *
 * Mirrors RestoreCaseDto: a mandatory 10-500 character reason, so the audit
 * trail says why a piece of evidence came back rather than only that it did.
 */
export class RestoreEvidenceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do khôi phục phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do khôi phục bắt buộc' })
  @MinLength(10, { message: 'Lý do khôi phục phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do khôi phục không được vượt quá 500 ký tự' })
  reason: string;
}
