import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

/**
 * F5 — DTO cho POST /subjects/bulk-export.
 *
 * Read-only export: cap 1000 ids/request (mirror cases.bulk-export). Subjects
 * polymorphic (SUSPECT/VICTIM/WITNESS) — service filter by id only, type info
 * preserved in Excel column.
 */
export class BulkExportSubjectsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 đối tượng để xuất Excel' })
  @ArrayMaxSize(1000, {
    message: 'Tối đa 1000 đối tượng mỗi lần xuất (chia nhỏ nếu nhiều hơn)',
  })
  @IsString({ each: true })
  ids: string[];
}
