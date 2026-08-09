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
   * Required to strip a role down to zero permissions.
   *
   * This endpoint replaces the whole set, so an empty array revokes
   * everything. That is exactly how the frontend matrix used to wipe roles:
   * it failed to load the current permissions, rendered an all-false grid,
   * and sent `[]` believing it was a no-op. Emptying a role is legitimate,
   * but it must be deliberate rather than the default outcome of a bug or a
   * truncated payload.
   */
  @IsBoolean()
  @IsOptional()
  allowEmpty?: boolean;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
