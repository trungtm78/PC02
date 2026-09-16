import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

export class QueryLawyersDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=hoTen~An&tk=thanChu~Bình`). Khoá và giá
   * trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @TheTimKiem()
  tk?: string[];

  /**
   * Ô tìm cũ (GlobalSearchBar, đường dẫn cũ) — máy chủ quy về thẻ "tất cả các cột" và tự cắt độ dài.
   * Không chặn độ dài ở đây: chặn là 400 trước khi kịp cắt, nhóm Luật sư lặng lẽ biến khỏi tìm chung.
   */
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;

  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
