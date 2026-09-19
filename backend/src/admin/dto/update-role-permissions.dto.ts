import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionEntryDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  subject: string;
}

export class UpdateRolePermissionsDto {
  /** Full replacement of permission list for the role */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions: PermissionEntryDto[];

  /**
   * Danh sách rỗng xoá SẠCH quyền của vai trò — chỉ nhận khi người dùng xác nhận rõ. Không có cờ này thì
   * rỗng là 400: màn cũ tải lỗi → lưới trống → "Lưu" gửi rỗng (đo prod 19/09/2026: OFFICER, 248 cán bộ).
   */
  @IsOptional()
  @IsBoolean()
  choPhepRong?: boolean;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
