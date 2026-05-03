/**
 * 2FA verification method — WIRE FORMAT.
 *
 * Values are accepted in `VerifyTwoFaDto.method` (POST /auth/2fa/verify)
 * from web and mobile clients. Audit log rows persist these strings in
 * the `metadata.method` column. Don't rename existing values; append new ones.
 */
export const TWO_FA_METHOD = {
  TOTP: 'totp',
  EMAIL_OTP: 'email_otp',
  BACKUP: 'backup',
} as const;

export type TwoFaMethod = (typeof TWO_FA_METHOD)[keyof typeof TWO_FA_METHOD];

export const TWO_FA_METHODS: readonly TwoFaMethod[] = Object.freeze(
  Object.values(TWO_FA_METHOD),
);
