import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
} from 'class-validator';

/**
 * v0.48 PR1 B3b — DTO cho POST /cases/bulk-export.
 *
 * Read-only export: cap 1000 ids/request (higher than write cap 100 vì read an toàn,
 * nhưng vẫn giới hạn memory + JSON payload size, plan eng E-H1).
 *
 * Future: thêm filter-based export (export all matching filter) ở PR sau, sẽ accept
 * `filter` object thay vì ids. Plan v2 chỉ ban "all matching filter" cho delete/status,
 * cho phép export.
 */
export class BulkExportCasesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ án để xuất Excel' })
  @ArrayMaxSize(1000, {
    message: 'Tối đa 1000 vụ án mỗi lần xuất (chia nhỏ nếu nhiều hơn)',
  })
  @IsString({ each: true })
  ids: string[];
}
