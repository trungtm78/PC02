import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * v0.32.0.0: body DTO cho POST /incidents/:id/restore.
 * Mirror DeleteIncidentDto pattern.
 */
export class RestoreIncidentDto {
  @IsString({ message: 'Lý do khôi phục phải là chuỗi ký tự' })
  @MinLength(10, { message: 'Lý do khôi phục phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do khôi phục không được vượt quá 500 ký tự' })
  reason: string;
}
