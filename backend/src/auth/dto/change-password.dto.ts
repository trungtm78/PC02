import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MSG } from '../constants/password.constants';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  newPassword: string;
}
