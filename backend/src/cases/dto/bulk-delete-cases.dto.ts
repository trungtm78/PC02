import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/**
 * v0.49 PR2 — DTO cho POST /cases/bulk-delete.
 * reason 10-500 chars (match DeleteCaseDto convention, plan eng E-H9).
 */
export class BulkDeleteCasesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ án để xóa' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 vụ án mỗi đợt' })
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
