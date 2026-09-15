import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  SO_THE_TOI_DA,
} from '../../common/tim-kiem/dieu-kien';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class QueryAddressMappingDto {
  @IsString() @IsOptional() province?: string;
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được. Khoá và giá trị kiểm ở
   * `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400).
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
  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột". */
  @IsString() @IsOptional() search?: string;
  @IsBoolean() @Transform(({ value }) => value === 'true' || value === true) @IsOptional() needsReview?: boolean;
  @IsBoolean() @Transform(({ value }) => value === 'true' || value === true) @IsOptional() isActive?: boolean;
  @IsInt() @Min(1) @Max(500) @Type(() => Number) @IsOptional() limit?: number = 50;
  @IsInt() @Min(0) @Type(() => Number) @IsOptional() offset?: number = 0;
}

export class LookupAddressMappingDto {
  @IsString() ward!: string;
  @IsString() district!: string;
  @IsString() @IsOptional() province?: string = 'HCM';
}
