import { ArrayNotEmpty, IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

/** Body xuất chứng từ động cho 1 vụ án/vụ việc. */
export class ExportEntityDocumentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  templateIds!: string[];

  @IsOptional()
  @IsIn(['merged', 'zip'])
  mode?: 'merged' | 'zip';

  /** Biến nhập tay (cho placeholder ngoài danh mục auto). */
  @IsOptional()
  @IsObject()
  manualValues?: Record<string, string>;
}
