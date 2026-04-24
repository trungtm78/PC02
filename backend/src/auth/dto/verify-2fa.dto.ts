import { IsEnum, IsString, Length } from 'class-validator';

export class VerifyTwoFaDto {
  @IsString()
  @Length(1, 20)
  code: string;

  @IsEnum(['totp', 'email_otp', 'backup'])
  method: 'totp' | 'email_otp' | 'backup';
}
