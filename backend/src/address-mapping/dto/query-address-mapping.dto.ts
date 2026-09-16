import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

export class QueryAddressMappingDto {
  @IsString() @IsOptional() province?: string;
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được. Khoá và giá trị kiểm ở
   * `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400).
   */
  @TheTimKiem()
  tk?: string[];
  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột". */
  @IsString() @IsOptional() search?: string;
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  needsReview?: boolean;
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isActive?: boolean;
  @IsInt() @Min(1) @Max(500) @Type(() => Number) @IsOptional() limit?: number =
    50;
  @IsInt() @Min(0) @Type(() => Number) @IsOptional() offset?: number = 0;
}

export class LookupAddressMappingDto {
  @IsString() ward!: string;
  @IsString() district!: string;
  @IsString() @IsOptional() province?: string = 'HCM';
}
