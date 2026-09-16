import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TheTimKiem } from '../tim-kiem/the-tim-kiem.decorator';

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
  @TheTimKiem()
  tk?: string[];
}
