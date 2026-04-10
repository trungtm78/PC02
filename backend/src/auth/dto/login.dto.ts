import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  username: string; // accepts email as username field

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
