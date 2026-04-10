import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DocumentType, { message: 'Loại tài liệu không hợp lệ' })
  @IsOptional()
  documentType?: DocumentType;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  incidentId?: string;
}
