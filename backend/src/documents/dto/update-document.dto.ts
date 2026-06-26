import { IsString, IsOptional } from 'class-validator';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsCatalogValue('DOCUMENT_TYPE', { message: 'Loại tài liệu không hợp lệ' })
  @IsOptional()
  documentType?: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  incidentId?: string;
}
