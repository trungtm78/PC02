import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Approver-initiated "request changes" on a submitted rule version.
 * Note ≥10 chars after trim. Sent back to draft for proposer to fix.
 */
export class RequestChangesDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ghi chú yêu cầu sửa phải là chuỗi' })
  @IsNotEmpty({ message: 'Ghi chú yêu cầu sửa không được trống' })
  @MinLength(10, { message: 'Ghi chú yêu cầu sửa phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Ghi chú yêu cầu sửa tối đa 1000 ký tự' })
  reviewNotes!: string;
}
