import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

export class QueryDocumentsDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=tieuDe~biên bản&tk=vuAn~Trộm cắp`). Khoá
   * và giá trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @TheTimKiem()
  tk?: string[];

  /**
   * Ô tìm cũ (đường dẫn cũ) — máy chủ quy về thẻ "tất cả các cột" và tự cắt độ dài. Không chặn độ dài
   * ở đây: chặn là 400 trước khi kịp cắt.
   */
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  incidentId?: string;

  @IsString()
  @IsOptional()
  petitionId?: string;

  @IsCatalogValue('DOCUMENT_TYPE')
  @IsOptional()
  documentType?: string;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
