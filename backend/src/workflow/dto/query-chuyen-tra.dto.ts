import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';
import { LOAI_HO_SO_CHUYEN_TRA } from '../chuyen-tra.types';

/** Tham số của GET /workflow/chuyen-tra — chỉ những khoá dùng CHUNG được cho cả ba loại hồ sơ. */
export class QueryChuyenTraDto {
  /** Lọc một loại hồ sơ; bỏ trống là cả ba. */
  @IsOptional()
  @IsIn(LOAI_HO_SO_CHUYEN_TRA)
  loai?: string;

  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột". */
  @IsOptional()
  @IsString()
  search?: string;

  /** Chỉ nhận thẻ `*`: ba loại hồ sơ có khai khác nhau, khoá riêng của loại này là khoá lạ với loại kia. */
  @TheTimKiem()
  tk?: string[];

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  /**
   * Cột ngày để lọc — màn gửi `NGAY_TIEP_NHAN` để lọc đúng cột "Ngày đề xuất" đang hiện. Thiếu khai ở
   * đây là ValidationPipe (`forbidNonWhitelisted`) trả 400 cho MỌI lượt tải màn.
   */
  @IsOptional()
  @IsString()
  thongKeTruongNgay?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
