import {
  IsBoolean,
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
// workId (Mã cán bộ / số hiệu ngành) là BẮT BUỘC — khóa định danh nội bộ.
// Email và phone là OPTIONAL — nhiều cán bộ Tổ 2 Đội 1 không có email công vụ.
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  // v0.28: username phải có ít nhất 1 ký tự chữ — KHÔNG được thuần số.
  // Lý do: chống collision với Mã cán bộ (workId) thuần số (Mã cán bộ độ dài tùy ý).
  // Negative lookahead `(?!^\d+$)` reject pattern thuần digit, vẫn cho phép mix.
  @Matches(/^(?!^\d+$)[a-z0-9_]+$/, {
    message:
      'username phải có ít nhất 1 ký tự chữ (không được thuần số) — tránh nhầm Mã cán bộ',
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
  @IsNotEmpty({ message: 'Mã cán bộ là bắt buộc' })
  workId: string;

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

  // v0.32.0.1: dispatcher permission cho phép user xem + assign tất cả
  // vụ án/vụ việc/đơn thư của tổ khác (Tổ trưởng / Trực ban). Frontend
  // checkbox trong CreateUserModal. Mirror UpdateUserDto:18-20 pattern.
  @IsBoolean()
  @IsOptional()
  canDispatch?: boolean;
}
