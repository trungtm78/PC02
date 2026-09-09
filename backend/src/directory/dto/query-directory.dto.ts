import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryDirectoryDto {
  @IsString()
  @IsOptional()
  type?: string;

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
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
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
