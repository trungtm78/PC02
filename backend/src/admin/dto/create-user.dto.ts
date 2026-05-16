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

// Magic link enrollment (post-/autoplan): admin tạo user → backend gen
// enrollment link 1-time (TTL 72h) → admin gửi user qua channel bất kỳ
// (Zalo cá nhân, SMS, email, in QR). User click → tự đặt password.
// Email là OPTIONAL — nhiều cán bộ Tổ 2 Đội 1 không có email công vụ.
// Service-level validate: phải có ≥1 trong (workId, phone, email).
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
  @IsOptional()
  email?: string;

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
