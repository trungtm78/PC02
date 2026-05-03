/**
 * 2FA verification method — must mirror
 * `backend/src/common/constants/two-fa-methods.constants.ts`.
 *
 * Values are sent in `POST /auth/2fa/verify { method }` and must match the
 * backend `@IsIn(TWO_FA_METHODS)` validator exactly.
 */
export const TWO_FA_METHOD = {
  TOTP: 'totp',
  EMAIL_OTP: 'email_otp',
  BACKUP: 'backup',
} as const;

export type TwoFaMethod = (typeof TWO_FA_METHOD)[keyof typeof TWO_FA_METHOD];
