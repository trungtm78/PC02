/**
 * Reads Vietnamese amounts of money, written either in digits or in words.
 *
 * Complaints give the same amount both ways ("495.253.647 đồng (Bốn trăm chín mươi lăm triệu ...)"). Reading both
 * independently and comparing them is the cheapest reliable check that a figure was transcribed correctly: a
 * misread digit and a misread word rarely agree. Anything that is not clearly a whole number gives null; the
 * parsers never guess.
 */

const CURRENCY = /(đồng|vnđ|vnd|đ)/g;

/** Whole-dong figure in digits. "." "," and spaces group thousands; a decimal part is refused. */
export function parseVietnameseDigits(text: string): number | null {
  const cleaned = text
    .normalize('NFC')
    .toLowerCase()
    .replace(CURRENCY, '')
    .replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;
  const parts = cleaned.split(/[.,]/);
  if (parts.length === 1) return Number(parts[0]);
  const [head, ...groups] = parts;
  const grouped =
    head.length >= 1 && head.length <= 3 && groups.every((g) => g.length === 3);
  return grouped ? Number([head, ...groups].join('')) : null;
}

const DIGITS: Readonly<Record<string, number>> = {
  không: 0,
  một: 1,
  mốt: 1,
  hai: 2,
  ba: 3,
  bốn: 4,
  tư: 4,
  năm: 5,
  lăm: 5,
  sáu: 6,
  bảy: 7,
  bẩy: 7,
  tám: 8,
  chín: 9,
};

/** Magnitude words, each larger than the one after it in a well-formed number. */
const UNITS: Readonly<Record<string, number>> = {
  nghìn: 1_000,
  ngàn: 1_000,
  triệu: 1_000_000,
  tỷ: 1_000_000_000,
  tỉ: 1_000_000_000,
};

/** Whole-dong figure in words ("hai mươi triệu đồng" = 20000000). Null if any word is not a number word. */
export function parseVietnameseWords(text: string): number | null {
  const tokens = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/bằng chữ/g, ' ')
    .replace(/(đồng|vnđ|vnd|chẵn)/g, ' ')
    .replace(/[(),.:;]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let group = 0; // value below one thousand being built
  let pending = 0; // a digit word waiting for its multiplier
  let lastUnit = Number.POSITIVE_INFINITY;
  let sawNumber = false;

  for (const token of tokens) {
    if (token in DIGITS) {
      if (pending !== 0) return null;
      pending = DIGITS[token];
      sawNumber = true;
    } else if (token === 'mười') {
      if (pending !== 0) return null;
      group += 10;
      sawNumber = true;
    } else if (token === 'mươi' || token === 'trăm') {
      if (pending === 0) return null;
      group += pending * (token === 'mươi' ? 10 : 100);
      pending = 0;
    } else if (token === 'linh' || token === 'lẻ') {
      continue;
    } else if (token in UNITS) {
      group += pending;
      pending = 0;
      const unit = UNITS[token];
      if (group === 0 || unit >= lastUnit) return null;
      total += group * unit;
      group = 0;
      lastUnit = unit;
    } else {
      return null;
    }
  }
  return sawNumber ? total + group + pending : null;
}
