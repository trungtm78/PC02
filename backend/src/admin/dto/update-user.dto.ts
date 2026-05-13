import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean } from 'class-validator';

// F1: admin no longer chooses passwords. Reset is triggered by the
// `resetPassword: true` flag — backend generates a new temp password,
// returns it ONCE in the response, sets mustChangePassword=true, increments
// tokenVersion to invalidate any active access token (C3 fix).
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsBoolean()
  @IsOptional()
  canDispatch?: boolean;

  @IsBoolean()
  @IsOptional()
  resetPassword?: boolean;
}
