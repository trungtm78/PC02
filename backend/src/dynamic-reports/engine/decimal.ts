import Decimal from 'decimal.js';

/**
 * Decimal engine — pure, no I/O. Design spec §4.1/§10 R2: this module (and
 * every file under dynamic-reports/engine/) must never import `@nestjs/*`,
 * `@prisma/*`, or Node's `fs`, because `gen:dr-engine` copies it verbatim
 * into the frontend bundle so the grid can recompute formula cells live.
 * The server remains the only source of the committed, authoritative value.
 *
 * FRD §4.4: NUM is exchanged over the API as a canonical decimal string
 * ("1234.50" — optional leading '-', digits, optional '.', digits; no
 * grouping, no exponent) and is never represented as a float, so comparison
 * and aggregation never drift from floating-point rounding. decimal.js gives
 * us arbitrary-precision arithmetic to enforce that.
 */

export const DECIMAL_LIMITS = {
  /** Max total significant digits (integer + fractional). FRD §4.4. */
  MAX_PRECISION: 18,
  /** Max digits after the decimal point. FRD §4.4. */
  MAX_SCALE: 4,
} as const;

export type DecimalLimits = { MAX_PRECISION: number; MAX_SCALE: number };

export type DecimalParseErrorCode =
  | 'NOT_A_NUMBER'
  | 'AMBIGUOUS_SEPARATOR'
  | 'PRECISION_EXCEEDED'
  | 'SCALE_EXCEEDED'
  | 'INFINITY_NOT_ALLOWED'
  | 'SCIENTIFIC_NOTATION_NOT_ALLOWED';

export interface DecimalParseError {
  code: DecimalParseErrorCode;
  message: string;
}

export type DecimalParseResult =
  | { ok: true; value: Decimal; canonical: string }
  | { ok: false; error: DecimalParseError };

function err(code: DecimalParseErrorCode, message: string): DecimalParseResult {
  return { ok: false, error: { code, message } };
}

/** Matches the canonical wire format exactly: -?\d+(\.\d+)? */
const CANONICAL_RE = /^-?\d+(\.\d+)?$/;

function countSignificantDigits(input: string): {
  precision: number;
  scale: number;
} {
  const unsigned = input.replace(/^-/, '');
  const [intPart, fracPart = ''] = unsigned.split('.');
  // Leading zeros of the integer part still count toward precision here;
  // real-world report inputs never carry them, and over-counting only ever
  // makes validation stricter, never silently permissive.
  return {
    precision: intPart.length + fracPart.length,
    scale: fracPart.length,
  };
}

/**
 * Validates a value already in canonical wire format. Use this on the
 * server when receiving `PATCH /assignments/:id/values` patches, and on the
 * client right before serializing a patch to send.
 */
export function parseCanonicalDecimal(
  input: string,
  limits: DecimalLimits = DECIMAL_LIMITS,
): DecimalParseResult {
  const trimmed = input.trim();

  if (/infinity/i.test(trimmed)) {
    return err('INFINITY_NOT_ALLOWED', 'Giá trị vô cực không được phép.');
  }
  if (/[eE]/.test(trimmed)) {
    return err(
      'SCIENTIFIC_NOTATION_NOT_ALLOWED',
      'Không hỗ trợ ký pháp khoa học (ví dụ 1.5e10) ở phiên bản này.',
    );
  }
  if (!CANONICAL_RE.test(trimmed)) {
    return err('NOT_A_NUMBER', `Giá trị "${input}" không phải số hợp lệ.`);
  }

  const { precision, scale } = countSignificantDigits(trimmed);
  if (scale > limits.MAX_SCALE) {
    return err(
      'SCALE_EXCEEDED',
      `Số lẻ vượt quá ${limits.MAX_SCALE} chữ số. Không tự làm tròn dữ liệu nhập.`,
    );
  }
  if (precision > limits.MAX_PRECISION) {
    return err(
      'PRECISION_EXCEEDED',
      `Tổng số chữ số vượt quá ${limits.MAX_PRECISION}.`,
    );
  }

  const value = new Decimal(trimmed);
  return { ok: true, value, canonical: toCanonicalString(value) };
}

/**
 * Splits a dot-separated numeral into "is this a thousands grouping" vs.
 * "is the single dot a decimal point" without ever guessing when it's
 * genuinely ambiguous. FRD §4.4: "Không tự đoán giữa dấu chấm thập phân và
 * dấu chấm phân nhóm; trường hợp mơ hồ phải báo cách sửa."
 *
 * `hasComma` is whether the *original full input* (not just this segment)
 * contained a comma. When it did, the comma has already claimed the
 * decimal-separator role, so any dot here is unambiguously a thousands
 * grouping — ambiguity can only arise when there is no comma anywhere to
 * disambiguate the lone dot.
 *
 * Returns the resolved digits-only representation (sign + integer digits +
 * optional '.' + fraction digits) on success, or an error.
 */
function resolveViVnGrouping(
  digitsAndDots: string,
  hasComma: boolean,
): { ok: true; resolved: string } | { ok: false; error: DecimalParseError } {
  const dotCount = (digitsAndDots.match(/\./g) ?? []).length;

  if (dotCount === 0) {
    return { ok: true, resolved: digitsAndDots };
  }

  const groups = digitsAndDots.split('.');
  // Every group except the first (leading) group must be exactly 3 digits
  // for this to be a valid thousands grouping at all.
  const nonLeadingGroupsValid = groups.slice(1).every((g) => /^\d{3}$/.test(g));
  const leadingGroupValid = /^\d{1,3}$/.test(groups[0]);

  if (dotCount >= 2 || hasComma) {
    // Multiple dots can only be thousands grouping — a decimal number has at
    // most one decimal point. A comma elsewhere in the input already fixed
    // the decimal separator, so a single dot here is grouping too, not an
    // ambiguous decimal point.
    if (leadingGroupValid && nonLeadingGroupsValid) {
      return { ok: true, resolved: groups.join('') };
    }
    return err(
      'NOT_A_NUMBER',
      `Nhóm chữ số không hợp lệ trong "${digitsAndDots}".`,
    ) as {
      ok: false;
      error: DecimalParseError;
    };
  }

  // Exactly one dot, no comma anywhere. Thousands grouping is only
  // *structurally possible* when the leading segment is 1-3 digits AND the
  // trailing segment is exactly 3 digits (a standard grouping never chunks
  // any other way). When both hold, grouping and decimal-point are equally
  // plausible report inputs — refuse to guess. In every other case (leading
  // segment too long for a grouping leader, or trailing segment not exactly
  // 3 digits), grouping is structurally impossible, so the dot can only be
  // a decimal point — e.g. "123456.789" (6-digit integer part) is
  // unambiguous even though the fractional part happens to be 3 digits.
  const lastGroup = groups[1];
  if (leadingGroupValid && /^\d{3}$/.test(lastGroup)) {
    return err(
      'AMBIGUOUS_SEPARATOR',
      `"${digitsAndDots}" mơ hồ: có thể là ${groups.join('')} (phân nhóm nghìn) ` +
        `hoặc ${groups[0]}.${lastGroup} (số thập phân). Dùng dấu phẩy cho phần thập phân, ví dụ "${groups[0]},${lastGroup}".`,
    ) as { ok: false; error: DecimalParseError };
  }

  return { ok: true, resolved: `${groups[0]}.${lastGroup}` };
}

/**
 * Parses vi-VN locale decimal input as typed or pasted by the user: grouped
 * ("1.234,50") or ungrouped ("1234,50"), dot = thousands separator, comma =
 * decimal separator. FRD §4.4: "dùng cùng quy tắc khi paste" — this same
 * function is the single entry point for both the typed-input path and the
 * paste-TSV path, so there is exactly one parsing rule to keep correct.
 */
export function parseViVnDecimalInput(
  input: string,
  limits: DecimalLimits = DECIMAL_LIMITS,
): DecimalParseResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return err('NOT_A_NUMBER', 'Giá trị rỗng.');
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;

  if (!/^[\d.,]+$/.test(unsigned)) {
    return err('NOT_A_NUMBER', `Giá trị "${input}" không phải số hợp lệ.`);
  }

  const commaCount = (unsigned.match(/,/g) ?? []).length;
  if (commaCount > 1) {
    return err('NOT_A_NUMBER', `Nhiều hơn một dấu phẩy trong "${input}".`);
  }

  let intPart: string;
  let fracPart = '';
  if (commaCount === 1) {
    const [before, after] = unsigned.split(',');
    if (after.length === 0) {
      return err('NOT_A_NUMBER', `Thiếu chữ số sau dấu phẩy trong "${input}".`);
    }
    intPart = before;
    fracPart = after;
  } else {
    intPart = unsigned;
  }

  if (!/^[\d.]*$/.test(fracPart) || fracPart.includes('.')) {
    return err('NOT_A_NUMBER', `Giá trị "${input}" không phải số hợp lệ.`);
  }

  const resolved = resolveViVnGrouping(intPart, commaCount === 1);
  if (!resolved.ok) return resolved;

  const canonicalBody = fracPart
    ? `${resolved.resolved}.${fracPart}`
    : resolved.resolved;
  const canonicalInput = negative ? `-${canonicalBody}` : canonicalBody;

  return parseCanonicalDecimal(canonicalInput, limits);
}

/** Canonical wire-format string for a Decimal: no grouping, no trailing zeros beyond what the value needs, no exponent. */
export function toCanonicalString(value: Decimal): string {
  return value.toFixed();
}

/**
 * Display-only vi-VN formatting (dot grouping, comma decimal). Never mutates
 * the stored value — FRD §4.4: "Preview phải cho thấy cả raw và formatted
 * để phát hiện sai lệch" and "#,##0 không tự biến dữ liệu 1.5 thành 2 khi
 * lưu". When `displayScale` is given the *display* is rounded to that many
 * places (matching an Excel number format like "#,##0"); the stored
 * canonical value is untouched — callers must keep reading it via
 * `toCanonicalString`, never by re-parsing the formatted string.
 */
export function formatViVnDecimal(
  value: Decimal,
  displayScale?: number,
): string {
  const rounded =
    displayScale === undefined ? value : value.toDecimalPlaces(displayScale);
  const [intPart, fracPart] = rounded.toFixed().split('.');
  const negative = intPart.startsWith('-');
  const digits = negative ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = negative ? '-' : '';
  return fracPart ? `${sign}${grouped},${fracPart}` : `${sign}${grouped}`;
}
