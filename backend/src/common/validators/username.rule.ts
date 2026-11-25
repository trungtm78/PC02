import { applyDecorators } from '@nestjs/common';
import { Length, Matches } from 'class-validator';

/**
 * THE rule of a login name, for every way an account is made or renamed (the admin form, the Excel import of users).
 *
 * Accounts named "ten.hodem.doi2" exist (made by `legacy-migration/cli/provision-doi2-accounts.ts`): dots, and up to 22
 * characters. The old rule (`[a-z0-9_]{3,20}`) refused them on every edit, so their accounts could not be saved at all.
 * Each check has its own message: the person is told what is wrong with the name, not a different rule.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50;

/** Lowercase letters, digits, "_" and "."; no dot at either end, no two dots in a row. */
const CHARACTERS = /^[a-z0-9_](?:[a-z0-9_]|\.(?!\.))*$/;
const ENDS_CLEAN = /^[^.].*[^.]$|^[^.]$/;
/** At least one letter: a name of digits only would be taken for an officer's code (Mã cán bộ). */
const HAS_LETTER = /[a-z]/;

export const USERNAME_MESSAGES = {
  length: `Tên đăng nhập dài từ ${USERNAME_MIN} đến ${USERNAME_MAX} ký tự`,
  characters: 'Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu gạch dưới (_) và dấu chấm (.), không bắt đầu hay kết thúc bằng dấu chấm, không có hai dấu chấm liền nhau',
  letter: 'Tên đăng nhập phải có ít nhất 1 chữ cái (không được chỉ gồm số), để không nhầm với Mã cán bộ',
} as const;

/** The problems of a login name, in the order above; empty when it is a valid name. */
export function usernameProblems(username: string): string[] {
  const problems: string[] = [];
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) problems.push(USERNAME_MESSAGES.length);
  if (!CHARACTERS.test(username) || !ENDS_CLEAN.test(username)) problems.push(USERNAME_MESSAGES.characters);
  if (!HAS_LETTER.test(username)) problems.push(USERNAME_MESSAGES.letter);
  return problems;
}

/** The same rule as decorators of a DTO property. */
export function IsUsername(): PropertyDecorator {
  return applyDecorators(
    Length(USERNAME_MIN, USERNAME_MAX, { message: USERNAME_MESSAGES.length }),
    Matches(CHARACTERS, { message: USERNAME_MESSAGES.characters }),
    Matches(ENDS_CLEAN, { message: USERNAME_MESSAGES.characters }),
    Matches(HAS_LETTER, { message: USERNAME_MESSAGES.letter }),
  );
}
