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

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// F1: admin no longer chooses the password. Backend generates a random temp
// password (returned ONCE in the response) and the user is forced to change
// it on first login. See AdminService.createUser + temp-password.util.
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
