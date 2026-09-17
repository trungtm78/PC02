import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';
import { TIEU_CHI_TRUNG } from '../don-trung.types';

/** Tham số của GET /petitions/duplicates — màn Đơn trùng và tệp xuất dùng chung. */
export class QueryDuplicatesDto {
  /** Tiêu chí gom nhóm; mặc định Họ tên người gửi. Mã lạ → 400 ngay ở cổng. */
  @IsOptional()
  @IsIn(TIEU_CHI_TRUNG)
  criteria?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  thongKeTruongNgay?: string;

  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột". */
  @IsOptional()
  @IsString()
  search?: string;

  @TheTimKiem()
  tk?: string[];

  /** Phân trang theo NHÓM trùng, không theo đơn. */
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
