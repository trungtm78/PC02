import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { IsWardDirectory } from '../../common/validators/is-ward-directory.validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsInt()
  @Min(0)
  level: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // v0.33.0.0: Hybrid ward scoping — gán phường cho geographic team
  @IsOptional()
  @IsWardDirectory({
    message: 'Phường không hợp lệ (id không tồn tại hoặc không phải WARD)',
  })
  wardId?: string | null;

  // v0.33.0.0: edit window override (giờ). NULL = dùng SystemSetting default
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  editWindowHours?: number | null;
}
