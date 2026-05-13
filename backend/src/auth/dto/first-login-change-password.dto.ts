import { IsString, MinLength, Matches } from 'class-validator';
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MSG } from '../constants/password.constants';

/**
 * D1 / first-login forced change. Note: NO `currentPassword` field — the user
 * does not know the temp password admin handed them in any meaningful sense
 * (it was admin's choice / system-generated). The endpoint is gated by
 * ChangePasswordPendingGuard which checks `mustChangePassword=true`.
 */
export class FirstLoginChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  newPassword: string;
}
