import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Proposer-initiated withdraw of a submitted rule version.
 * Reason mirrors reject's notes — required ≥10 chars after trim so audit log
 * captures a real explanation (not whitespace).
 */
export class WithdrawRuleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do thu hồi phải là chuỗi' })
  @IsNotEmpty({ message: 'Lý do thu hồi không được trống' })
  @MinLength(10, { message: 'Lý do thu hồi phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do thu hồi tối đa 1000 ký tự' })
  withdrawNotes!: string;
}
