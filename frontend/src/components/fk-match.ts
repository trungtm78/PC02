import { khopKhongDau as fuzzyMatch } from '@/lib/bo-dau';

/** "ttd" finds "Tổ Thanh Đa": the initials of the words, from two letters typed. */
export function matchesAbbreviation(text: string, query: string): boolean {
  if (!query || query.length < 2) return false;
  const initials = text
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toLowerCase();
  return initials.includes(query.toLowerCase());
}

/**
 * How a type-to-find picker matches an option: accent-insensitive (`khopKhongDau`), or by the initials of its words.
 * Shared by FKSelect and MultiFKSelect so both find the same things for the same typing.
 */
export function smartMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (fuzzyMatch(text, query)) return true;
  if (matchesAbbreviation(text, query)) return true;
  return false;
}
