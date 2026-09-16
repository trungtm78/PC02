import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from './create-user.dto';
import { TheTimKiem } from '../../common/tim-kiem/the-tim-kiem.decorator';

export class QueryUsersDto {
  /**
   * Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được (`?tk=hoTen~An&tk=trangThai~active`). Khoá và giá
   * trị kiểm ở `common/tim-kiem/dieu-kien.ts` (khoá lạ → 400). Giới hạn ở đây chặn yêu cầu quá cỡ.
   */
  @TheTimKiem()
  tk?: string[];

  /** Ô tìm cũ — máy chủ quy về thẻ "tất cả các cột" và tự cắt độ dài. */
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  roleId?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;
}
