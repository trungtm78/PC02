import { randomInt } from 'crypto';
import { STRONG_PASSWORD_REGEX } from '../constants/password.constants';

/**
 * Charset definitions — exclude visually ambiguous characters (I, O, l, 0, 1)
 * so that admin can read out the temp password to a cán bộ over phone or
 * write it on paper without transcription errors.
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
const DIGIT = '23456789'; // no 0, 1
const SPECIAL = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGIT + SPECIAL;

/**
 * Generates a cryptographically random temp password that is GUARANTEED to
 * satisfy STRONG_PASSWORD_REGEX (≥1 uppercase, ≥1 digit, ≥1 special) and a
 * minimum length suitable for bcrypt hashing.
 *
 * Uses crypto.randomInt for unbiased selection (no modulo bias).
 * Used by AdminService when admin creates a user OR resets a password —
 * admin sees the plaintext exactly once via TempPasswordHandoverModal, then
 * the user is forced to change it on first login.
 *
 * @security plaintext value — never log, never store unhashed.
 */
export function generateTempPassword(length = 16): string {
  if (length < 4) {
    throw new Error('Temp password length must be at least 4 (one of each required category)');
  }

  // Guaranteed one from each required class first.
  const chars: string[] = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGIT[randomInt(DIGIT.length)],
    SPECIAL[randomInt(SPECIAL.length)],
  ];
  // Fill remaining from the full alphabet.
  for (let i = chars.length; i < length; i++) {
    chars.push(ALL[randomInt(ALL.length)]);
  }
  // Fisher-Yates shuffle so the guaranteed chars are not always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const pw = chars.join('');

  // Defense-in-depth: if the generator ever regresses, fail hard rather than
  // expose a weak password.
  if (!STRONG_PASSWORD_REGEX.test(pw) || pw.length < 8) {
    throw new Error('Temp password generator produced an invalid password');
  }
  return pw;
}
