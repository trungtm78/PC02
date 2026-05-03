/**
 * Wire-format snapshot for JWT token type.
 *
 * `payload.type === 'refresh'` is encoded into every refresh token issued by
 * `auth.service.ts#generateTokens` and `two-fa.service.ts#generateTokenPair`,
 * and read by `jwt.strategy.ts#validate`.
 *
 * If anyone changes the `TOKEN_TYPE.REFRESH` value, every active refresh token
 * issued before that change becomes invalid — and worse, an access token
 * (no `type` field) might suddenly look like a refresh token if the new value
 * happens to be `undefined` or the empty string.
 *
 * This test pins the wire value. Changing it is a coordinated, intentional
 * decision — not a typo.
 */

import { TOKEN_TYPE } from '../common/constants/token-types.constants';

describe('JWT TOKEN_TYPE wire format', () => {
  it('REFRESH value is "refresh" — DO NOT CHANGE without a coordinated migration', () => {
    expect(TOKEN_TYPE.REFRESH).toBe('refresh');
  });

  it('TWO_FA_PENDING value is "2fa_pending" — DO NOT CHANGE without a coordinated migration', () => {
    expect(TOKEN_TYPE.TWO_FA_PENDING).toBe('2fa_pending');
  });

  it('refresh-token JWT payload contains type:"refresh" verbatim', () => {
    // Simulate what auth.service.generateTokens spreads into the payload
    const accessPayload = { sub: 'u1', email: 'a@b', role: 'INVESTIGATOR' };
    const refreshPayload = { ...accessPayload, type: TOKEN_TYPE.REFRESH };

    expect(refreshPayload.type).toBe('refresh');
    expect(JSON.stringify(refreshPayload)).toContain('"type":"refresh"');
  });
});
