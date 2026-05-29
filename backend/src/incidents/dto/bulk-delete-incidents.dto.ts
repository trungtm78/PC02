import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class BulkDeleteIncidentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ việc để xóa' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 vụ việc mỗi đợt' })
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @Length(10, 500, { message: 'Lý do xóa phải từ 10 đến 500 ký tự' })
  reason: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  idempotencyKey?: string;
}
