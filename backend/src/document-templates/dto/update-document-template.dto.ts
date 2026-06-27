import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateDocumentTemplateDto } from './create-document-template.dto';

/** Cập nhật template: tất cả optional, KHÔNG đổi `code` (định danh) và file (qua endpoint riêng). */
export class UpdateDocumentTemplateDto extends PartialType(
  OmitType(CreateDocumentTemplateDto, ['code'] as const),
) {}
