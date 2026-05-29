import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/**
 * v0.49 PR2 — DTO cho POST /cases/bulk-restore (admin-only at controller).
 */
export class BulkRestoreCasesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ án để khôi phục' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 vụ án mỗi đợt' })
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @Length(10, 500, { message: 'Lý do khôi phục phải từ 10 đến 500 ký tự' })
  reason: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  idempotencyKey?: string;
}
