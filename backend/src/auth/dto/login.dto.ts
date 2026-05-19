import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  // v0.27 multi-field login: accept email / workId / phone / username shape.
  // Backend service (auth.service.login) classify shape via classifyIdentifier()
  // → query đúng field. KHÔNG dùng @IsEmail() — sẽ reject non-email ở ValidationPipe
  // trước khi tới service logic.
  // MinLength(3) chống empty/whitespace abuse. MaxLength(254) = RFC 5322 email cap,
  // bao trùm tất cả 4 shape upper bounds.
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(254)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
