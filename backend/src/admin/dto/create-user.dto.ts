import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MSG } from '../../auth/constants/password.constants';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'username chỉ được chứa chữ thường, số và dấu _',
  })
  username: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  workId?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
