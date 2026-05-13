/**
 * Codex challenge #5: api.ts request interceptor must NOT overwrite a
 * per-request Authorization header. Otherwise pending-token calls
 * (firstLoginChangePassword, sendEmailOtp, verifyTwoFa) get their bearer
 * silently replaced by a stale accessToken from sessionStorage, causing
 * the backend guard to reject with 401.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../api';

describe('api request interceptor — Authorization header', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('attaches accessToken from sessionStorage when no header is set', () => {
    sessionStorage.setItem('accessToken', 'session_token_xyz');
    const config: any = { headers: {} };
    // Run the interceptor (it's the first request handler).
    const handler = (api.interceptors.request as any).handlers[0].fulfilled;
    const result = handler(config);
    expect(result.headers.Authorization).toBe('Bearer session_token_xyz');
  });

  // Codex #5: per-request token (e.g. changePasswordToken) must survive.
  it('preserves an existing Authorization header even when sessionStorage has a token', () => {
    sessionStorage.setItem('accessToken', 'session_token_xyz');
    const config: any = {
      headers: { Authorization: 'Bearer per_request_pending_token' },
    };
    const handler = (api.interceptors.request as any).handlers[0].fulfilled;
    const result = handler(config);
    expect(result.headers.Authorization).toBe('Bearer per_request_pending_token');
  });

  it('does not set Authorization when neither sessionStorage nor per-request header exists', () => {
    const config: any = { headers: {} };
    const handler = (api.interceptors.request as any).handlers[0].fulfilled;
    const result = handler(config);
    expect(result.headers.Authorization).toBeUndefined();
  });
});
