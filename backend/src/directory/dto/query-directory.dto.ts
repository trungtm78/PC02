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

export class QueryDirectoryDto {
  @IsString()
  @IsOptional()
  type?: string;

  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=ten~trom&tk=trangThai~active`). Khoá và giá
   * trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @TheTimKiem()
  tk?: string[];

  /** Ô tìm cũ (ô chọn FKSelect khắp hệ thống) — máy chủ quy về thẻ "tất cả các cột" (mã + tên + mô tả). */
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  isActive?: boolean;

  /**
   * Lọc nhóm CHỜ DUYỆT (mục nạp từ dữ liệu cũ chưa xác nhận, hoặc cán bộ tự tạo trên ô tìm).
   * Bỏ trống = lấy cả hai.
   */
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsOptional()
  choDuyet?: boolean;

  @IsInt()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;
}
