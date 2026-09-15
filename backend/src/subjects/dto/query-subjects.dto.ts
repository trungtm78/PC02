import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SubjectStatus, SubjectType } from '@prisma/client';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  SO_THE_TOI_DA,
} from '../../common/tim-kiem/dieu-kien';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class QuerySubjectsDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=hoTen~An&tk=vuAn~Trộm cắp`). Khoá và giá
   * trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayMaxSize(SO_THE_TOI_DA)
  @IsString({ each: true })
  @MaxLength(DO_DAI_MUC_THE_TOI_DA, { each: true })
  tk?: string[];

  /** Ô tìm cũ (GlobalSearchBar, đường dẫn cũ) — máy chủ quy về thẻ "tất cả các cột". */
  @IsString()
  @IsOptional()
  @MaxLength(DO_DAI_GIA_TRI_TOI_DA)
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
