import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DO_DAI_GIA_TRI_TOI_DA, SO_THE_TOI_DA } from '../tim-kiem/dieu-kien';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

/**
 * Tham số danh sách hồ sơ ĐÃ XOÁ (`GET /cases|incidents|petitions/admin/deleted`, màn Khôi phục).
 *
 * Trước đây ba controller khai kiểu TypeScript trần `{ limit?; offset?; search? }` — ValidationPipe
 * không có lớp để kiểm, `limit=abc` lọt xuống thành NaN. Một DTO dùng chung cho cả ba.
 */
export class QueryDaXoaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột" của khai hồ sơ. */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được. Khoá và giá trị kiểm ở
   * `common/tim-kiem/dieu-kien.ts` theo khai của từng loại hồ sơ (khoá lạ → 400).
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
}
