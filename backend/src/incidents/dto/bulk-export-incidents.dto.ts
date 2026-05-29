import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkExportIncidentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ việc để xuất Excel' })
  @ArrayMaxSize(1000, { message: 'Tối đa 1000 vụ việc mỗi lần xuất' })
  @IsString({ each: true })
  ids: string[];
}
