import { IsString, MinLength, MaxLength } from 'class-validator';

export class DeleteIncidentDto {
  @IsString({ message: 'Lý do xóa phải là chuỗi ký tự' })
  @MinLength(10, { message: 'Lý do xóa phải có ít nhất 10 ký tự' })
  @MaxLength(500, { message: 'Lý do xóa không được vượt quá 500 ký tự' })
  reason: string;
}
