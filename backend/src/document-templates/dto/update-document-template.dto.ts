import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreateDocumentTemplateDto } from './create-document-template.dto';

/** Cập nhật template: tất cả optional, KHÔNG đổi `code` (định danh) và file (qua endpoint riêng). */
export class UpdateDocumentTemplateDto extends PartialType(
  OmitType(CreateDocumentTemplateDto, ['code'] as const),
) {
  /** PR2: tên các biến BẮT BUỘC để in (admin tick). Service set cờ required trên variables. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredVariables?: string[];
}
