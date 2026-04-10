import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  title: string;

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

  // File upload fields (set by controller after multer processing — whitelisted to avoid validation rejection)
  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  originalName?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsOptional()
  size?: number;

  @IsString()
  @IsOptional()
  filePath?: string;
}
