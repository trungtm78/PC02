import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { STRONG_PASSWORD_REGEX, STRONG_PASSWORD_MSG } from '../../auth/constants/password.constants';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  password?: string;
}
