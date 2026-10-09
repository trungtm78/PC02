import fc from 'fast-check';
import Decimal from 'decimal.js';
import {
  DECIMAL_LIMITS,
  parseCanonicalDecimal,
  parseViVnDecimalInput,
  toCanonicalString,
  formatViVnDecimal,
} from './decimal';

/**
 * Decimal engine — the single source of truth for every NUM value in
 * dynamic-reports. Spec §4.1/§10 R2: this file is PURE (no @nestjs, @prisma,
 * fs) so it can be copied verbatim to the frontend by `gen:dr-engine` and
 * used for live formula recompute in the grid; the server remains the
 * authoritative source of the committed number.
 *
 * FRD §4.4: API exchanges decimals as canonical strings ("1234.50"), never
 * floats. The UI accepts vi-VN input ("1.234,50" grouped or "1234,50"
 * ungrouped) and must refuse to guess when a lone dot could mean either the
 * decimal point or a thousands grouping — see parseViVnDecimalInput below.
 */
describe('parseCanonicalDecimal', () => {
  it('accepts a plain integer', () => {
    const result = parseCanonicalDecimal('125');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toString()).toBe('125');
  });

  it('accepts a negative decimal within scale', () => {
    const result = parseCanonicalDecimal('-12.5');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.toString()).toBe('-12.5');
  });

  it('accepts exactly 18 significant digits and 4 decimal places', () => {
    const result = parseCanonicalDecimal('12345678901234.6789'); // 14 int + 4 frac = 18
    expect(result.ok).toBe(true);
  });

  it('rejects more than 18 significant digits', () => {
    const result = parseCanonicalDecimal('1234567890123456789');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PRECISION_EXCEEDED');
  });

  it('rejects more than 4 decimal places (no silent rounding)', () => {
    const result = parseCanonicalDecimal('1.23456');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SCALE_EXCEEDED');
  });

  it('rejects letters', () => {
    const result = parseCanonicalDecimal('12a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_NUMBER');
  });

  it('rejects NaN literal', () => {
    const result = parseCanonicalDecimal('NaN');
    expect(result.ok).toBe(false);
  });

  it('rejects Infinity literal', () => {
    const result = parseCanonicalDecimal('Infinity');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INFINITY_NOT_ALLOWED');
  });

  it('rejects scientific notation', () => {
    const result = parseCanonicalDecimal('1.5e10');
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.code).toBe('SCIENTIFIC_NOTATION_NOT_ALLOWED');
  });

  it('rejects thousands-grouped input (not canonical)', () => {
    const result = parseCanonicalDecimal('1,234.50');
    expect(result.ok).toBe(false);
  });

  it('respects a caller-supplied scale limit (e.g. scale=0 for quantities)', () => {
    const result = parseCanonicalDecimal('1.5', {
      MAX_PRECISION: 18,
      MAX_SCALE: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SCALE_EXCEEDED');
  });

  it('does not round 1.5 down to 2 when scale=0 is violated (FRD: no silent rounding)', () => {
    const result = parseCanonicalDecimal('1.5', {
      MAX_PRECISION: 18,
      MAX_SCALE: 0,
    });
    expect(result.ok).toBe(false);
  });
});

describe('parseViVnDecimalInput', () => {
  // Canonical output is normalized (insignificant trailing zeros stripped),
  // same as Decimal#toFixed(): "1234.50" and "1234.5" are the same number,
  // and the wire format is `-?\d+(\.\d+)?` with no requirement to preserve
  // how many trailing zeros the user happened to type. Display formatting
  // with a fixed number of decimals is a separate, later concern
  // (formatViVnDecimal / the field's Excel number format), never this raw
  // parser's job.
  it('accepts grouped input with comma decimal: 1.234,50', () => {
    const result = parseViVnDecimalInput('1.234,50');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('1234.5');
  });

  it('accepts ungrouped input with comma decimal: 1234,50', () => {
    const result = parseViVnDecimalInput('1234,50');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('1234.5');
  });

  it('accepts a plain integer with no separators', () => {
    const result = parseViVnDecimalInput('125');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('125');
  });

  it('accepts negative grouped input', () => {
    const result = parseViVnDecimalInput('-1.234,50');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('-1234.5');
  });

  it('accepts multi-group thousands with no decimal part: 12.345.678', () => {
    const result = parseViVnDecimalInput('12.345.678');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('12345678');
  });

  it('REFUSES to guess a lone dot followed by exactly 3 digits (AMBIGUOUS_SEPARATOR)', () => {
    // Could mean "1234" (dot = thousands grouping) or "1.234" (dot = decimal point).
    // FRD: "Không tự đoán ... trường hợp mơ hồ phải báo cách sửa."
    const result = parseViVnDecimalInput('1.234');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AMBIGUOUS_SEPARATOR');
  });

  it('treats a lone dot followed by 2 digits as a decimal point (not a valid grouping)', () => {
    const result = parseViVnDecimalInput('1.23');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('1.23');
  });

  it('treats a lone dot followed by 1 digit as a decimal point', () => {
    const result = parseViVnDecimalInput('1.2');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('1.2');
  });

  it('treats a lone dot followed by 5 digits as a decimal point, then enforces scale', () => {
    const result = parseViVnDecimalInput('1.23456');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SCALE_EXCEEDED');
  });

  it('rejects an invalid grouping (middle group not exactly 3 digits): 12.34.567', () => {
    const result = parseViVnDecimalInput('12.34.567');
    expect(result.ok).toBe(false);
  });

  it('rejects a comma with no digits after it', () => {
    const result = parseViVnDecimalInput('125,');
    expect(result.ok).toBe(false);
  });

  it('rejects letters', () => {
    const result = parseViVnDecimalInput('mot tram');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_NUMBER');
  });

  it('treats a 6+ digit leading part followed by 3 digits as unambiguously decimal (too long to be a grouping leader)', () => {
    const result = parseViVnDecimalInput('123456.789');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.canonical).toBe('123456.789');
  });

  it('rejects more than one comma', () => {
    const result = parseViVnDecimalInput('1,234,50');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_NUMBER');
  });

  it('rejects a dot inside the fractional part after the comma: 1234,5.6', () => {
    const result = parseViVnDecimalInput('1234,5.6');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_NUMBER');
  });

  it('same parsing rule applies on paste as on typed input (FRD: "dùng cùng quy tắc khi paste")', () => {
    const typed = parseViVnDecimalInput('1.234,50');
    const pasted = parseViVnDecimalInput('1.234,50');
    expect(pasted).toEqual(typed);
  });
});

describe('toCanonicalString / formatViVnDecimal', () => {
  it('round-trips a Decimal to its canonical string with no grouping', () => {
    const value = new Decimal('1234.50');
    expect(toCanonicalString(value)).toBe('1234.5');
  });

  it('formats a Decimal for vi-VN display with grouping and comma decimal', () => {
    const value = new Decimal('1234.5');
    expect(formatViVnDecimal(value)).toBe('1.234,5');
  });

  it('formatting is display-only and never mutates the stored canonical value (FRD: "#,##0 không tự biến 1.5 thành 2")', () => {
    const value = new Decimal('1.5');
    expect(formatViVnDecimal(value, 0)).toBe('2'); // display rounds for a 0-scale format
    expect(toCanonicalString(value)).toBe('1.5'); // stored value is untouched
  });
});

describe('DECIMAL_LIMITS', () => {
  it('defaults to precision 18 / scale 4 per spec §4.4', () => {
    expect(DECIMAL_LIMITS.MAX_PRECISION).toBe(18);
    expect(DECIMAL_LIMITS.MAX_SCALE).toBe(4);
  });
});

describe('properties', () => {
  it('parseCanonicalDecimal never throws for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => parseCanonicalDecimal(input)).not.toThrow();
      }),
    );
  });

  it('parseViVnDecimalInput never throws for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => parseViVnDecimalInput(input)).not.toThrow();
      }),
    );
  });

  it('round-trips any value within limits through toCanonicalString -> parseCanonicalDecimal with no precision loss', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.boolean(),
          fc.string({
            unit: fc.constantFrom(
              '0',
              '1',
              '2',
              '3',
              '4',
              '5',
              '6',
              '7',
              '8',
              '9',
            ),
            minLength: 1,
            maxLength: 14,
          }),
          fc.string({
            unit: fc.constantFrom(
              '0',
              '1',
              '2',
              '3',
              '4',
              '5',
              '6',
              '7',
              '8',
              '9',
            ),
            minLength: 0,
            maxLength: 4,
          }),
        ),
        ([negative, intDigits, fracDigits]) => {
          const intPart = intDigits.replace(/^0+(?=\d)/, ''); // avoid "-0" / leading-zero edge noise
          const body =
            fracDigits.length > 0 ? `${intPart}.${fracDigits}` : intPart;
          const input = negative && intPart !== '0' ? `-${body}` : body;

          const first = parseCanonicalDecimal(input);
          expect(first.ok).toBe(true);
          if (!first.ok) return;

          const canonical = toCanonicalString(first.value);
          const second = parseCanonicalDecimal(canonical);
          expect(second.ok).toBe(true);
          if (!second.ok) return;

          expect(first.value.equals(second.value)).toBe(true);
        },
      ),
    );
  });

  it('formatViVnDecimal never changes the underlying value — only toCanonicalString is the source of truth', () => {
    fc.assert(
      fc.property(
        fc.string({
          unit: fc.constantFrom(
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
          ),
          minLength: 1,
          maxLength: 10,
        }),
        (digits) => {
          const value = new Decimal(digits.replace(/^0+(?=\d)/, '') || '0');
          const before = toCanonicalString(value);
          formatViVnDecimal(value, 2); // display with forced 2dp — must not mutate `value`
          const after = toCanonicalString(value);
          expect(after).toBe(before);
        },
      ),
    );
  });
});
