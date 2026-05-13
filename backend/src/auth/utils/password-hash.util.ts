import * as bcrypt from 'bcrypt';

/**
 * bcrypt cost factor — extracted from the previously-hardcoded `12` scattered
 * across auth.service.ts, admin.service.ts, and forgot-pw flow. Test env uses
 * cost 4 to keep the auth test surface (~30 password ops) fast (~5s instead
 * of 60s+ at cost 12).
 *
 * Reads NODE_ENV at call time so individual tests can temporarily override it.
 */
export function getBcryptCost(): number {
  return process.env.NODE_ENV === 'test' ? 4 : 12;
}

/**
 * Hash a plaintext password using the environment-appropriate bcrypt cost.
 * Replaces all `bcrypt.hash(pw, 12)` call sites for consistency.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, getBcryptCost());
}
