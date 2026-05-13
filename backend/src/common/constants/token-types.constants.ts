/**
 * JWT token type — WIRE FORMAT, DO NOT CHANGE VALUES.
 *
 * These values are encoded into JWT payloads (`payload.type`) and persist in:
 *   - Active user sessions until token expiry (max 7 days for refresh tokens)
 *   - Mobile clients holding offline-issued tokens
 *
 * Changing a value WILL cause:
 *   - Mass user logout (all currently-issued refresh tokens reject)
 *   - Potential privilege escalation if a refresh-token check stops matching
 *     and an access token is mistakenly accepted in its place.
 *
 * To rotate values, you must coordinate with a `tokenVersion` bump on every
 * user, plus a forced re-login window. See `auth.service.ts` and
 * `jwt.strategy.ts`.
 */
export const TOKEN_TYPE = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  TWO_FA_PENDING: '2fa_pending',
  CHANGE_PASSWORD_PENDING: 'change_password_pending',
} as const;

export type TokenType = (typeof TOKEN_TYPE)[keyof typeof TOKEN_TYPE];
