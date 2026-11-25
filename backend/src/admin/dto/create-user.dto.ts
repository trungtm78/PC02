import { IsUsername } from '../../common/validators/username.rule';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  // One rule for every way an account is named (common/validators/username.rule.ts): dots allowed, 3-50 characters,
  // at least one letter (a name of digits only would be taken for the officer's code).
  @IsUsername()
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
