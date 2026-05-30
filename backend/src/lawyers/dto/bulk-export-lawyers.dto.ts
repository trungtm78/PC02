import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

/**
 * F5 — DTO cho POST /lawyers/bulk-export.
 *
 * Read-only export: cap 1000 ids/request (mirror cases.bulk-export). Read an
 * toàn nhưng vẫn giới hạn memory + JSON payload size.
 */
export class BulkExportLawyersDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 luật sư để xuất Excel' })
  @ArrayMaxSize(1000, {
    message: 'Tối đa 1000 luật sư mỗi lần xuất (chia nhỏ nếu nhiều hơn)',
  })
  @IsString({ each: true })
  ids: string[];
}
