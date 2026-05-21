import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * v0.31.0.2: body DTO cho DELETE /cases/:id.
 * Mirror DeleteIncidentDto pattern — reason 10-500 ký tự bắt buộc cho audit trail.
 */
export class DeleteCaseDto {
  @IsString({ message: 'Lý do xóa phải là chuỗi ký tự' })
  @MinLength(10, { message: 'Lý do xóa phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do xóa không được vượt quá 500 ký tự' })
  reason: string;
}
