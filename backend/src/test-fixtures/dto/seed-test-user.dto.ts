import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * The email MUST match this exact prefix pattern. Even with the right token,
 * the endpoint refuses to touch any user outside the e2e namespace — this
 * means a leaked token cannot be weaponized to reset real cán bộ passwords.
 */
export const E2E_EMAIL_PATTERN = /^e2e\+[a-z0-9_-]+@test\.pc02\.local$/;

export class SeedTestUserDto {
  @IsEmail()
  @Matches(E2E_EMAIL_PATTERN, {
    message:
      'email must match e2e+<slug>@test.pc02.local — production emails are rejected',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @IsOptional()
  @IsBoolean()
  twoFaEnabled?: boolean;

  /**
   * Set true to simulate "admin reset password again" mid-flow. Increments
   * tokenVersion which invalidates the user's existing changePasswordToken,
   * triggering the 409 Conflict path Codex C7 / Claude F2 flagged.
   */
  @IsOptional()
  @IsBoolean()
  bumpTokenVersion?: boolean;
}
