import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SubjectStatus, SubjectType } from '@prisma/client';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

export class QuerySubjectsDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=hoTen~An&tk=vuAn~Trộm cắp`). Khoá và giá
   * trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @TheTimKiem()
  tk?: string[];

  /**
   * Ô tìm cũ (GlobalSearchBar, đường dẫn cũ) — máy chủ quy về thẻ "tất cả các cột" và tự cắt độ dài.
   * Không chặn độ dài ở đây: chặn là 400 trước khi kịp cắt, nhóm Đối tượng lặng lẽ biến khỏi tìm chung.
   */
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(SubjectStatus)
  @IsOptional()
  status?: SubjectStatus;

  @IsEnum(SubjectType)
  @IsOptional()
  type?: SubjectType;

  @IsString()
  @IsOptional()
  caseId?: string;

  @IsString()
  @IsOptional()
  crimeId?: string;

  @IsString()
  @IsOptional()
  districtId?: string;

  @IsString()
  @IsOptional()
  wardId?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

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

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
