import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Danh mục ĐỘNG: @IsCatalogValue pass ở DTO, validate tồn tại ở service qua CatalogService.isValid.
  @IsCatalogValue('DOCUMENT_TYPE', { message: 'Loại tài liệu không hợp lệ' })
  @IsOptional()
  documentType?: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  incidentId?: string;

  @IsString()
  @IsOptional()
  petitionId?: string;

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
