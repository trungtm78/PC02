import {
  validateFieldValue,
  parseIsoDate,
  parseLocalizedDate,
  parseTimeOfDay,
  TEXT_DEFAULT_MAX_LENGTH,
} from './values';
import type { FieldDefinitionLike } from './values';

/**
 * Values engine — per-field validation for the four grammar types (FRD
 * §4.4): NUM (delegates to the decimal engine), TEXT, DATE (ISO date-only),
 * TIME (HH:mm). Pure — no I/O, shared with the frontend via gen:dr-engine
 * (spec §10 R2) so the grid can show the same error the server will give
 * before the user even saves.
 *
 * This engine validates and normalizes; it does NOT escape for rendering
 * (that is the export engine's job via the existing escapeXlsxCell, AC-020)
 * and it does NOT interpret Excel serial-date numbers (that is the template
 * parser's job when reading literal cells, PR3) — a plain numeric string
 * typed into a DATE field is simply an invalid date format here.
 */

function numField(
  overrides: Partial<FieldDefinitionLike> = {},
): FieldDefinitionLike {
  return { type: 'NUM', required: false, ...overrides };
}

describe('validateFieldValue — NUM', () => {
  it('accepts a plain integer', () => {
    const result = validateFieldValue(numField(), '125');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ t: 'NUM', v: '125' });
  });

  it('rejects letters (delegates to decimal engine)', () => {
    const result = validateFieldValue(numField(), '12a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_NUMBER');
  });

  it('rejects NaN', () => {
    const result = validateFieldValue(numField(), 'NaN');
    expect(result.ok).toBe(false);
  });

  it('rejects Infinity', () => {
    const result = validateFieldValue(numField(), 'Infinity');
    expect(result.ok).toBe(false);
  });

  it('rejects scientific notation', () => {
    const result = validateFieldValue(numField(), '1.5e3');
    expect(result.ok).toBe(false);
  });

  it('rejects a value below min', () => {
    const result = validateFieldValue(numField({ min: '0' }), '-5');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OUT_OF_RANGE');
  });

  it('rejects a value above max', () => {
    const result = validateFieldValue(numField({ max: '100' }), '150');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OUT_OF_RANGE');
  });

  it('accepts a value exactly at min (inclusive)', () => {
    const result = validateFieldValue(numField({ min: '0' }), '0');
    expect(result.ok).toBe(true);
  });

  it('accepts a value exactly at max (inclusive)', () => {
    const result = validateFieldValue(numField({ max: '100' }), '100');
    expect(result.ok).toBe(true);
  });

  it('enforces a field-level scale=0 for quantity fields (no silent rounding of 1.5)', () => {
    const result = validateFieldValue(numField({ scale: 0 }), '1.5');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SCALE_EXCEEDED');
  });

  it('rejects null when required', () => {
    const result = validateFieldValue(numField({ required: true }), null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REQUIRED');
  });

  it('accepts null when not required (field left blank)', () => {
    const result = validateFieldValue(numField({ required: false }), null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ t: 'NUM', v: null });
  });

  it('rejects empty string the same as null', () => {
    const result = validateFieldValue(numField({ required: true }), '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('REQUIRED');
  });
});

describe('validateFieldValue — TEXT', () => {
  it('keeps Unicode and leading zeros exactly as typed (FRD: "giữ số 0 đầu")', () => {
    const result = validateFieldValue(
      { type: 'TEXT', required: false },
      '007 — Đội 3',
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value).toEqual({ t: 'TEXT', v: '007 — Đội 3' });
  });

  it('does not treat a leading "=" as a formula — stores the literal string unchanged (AC-020)', () => {
    const result = validateFieldValue(
      { type: 'TEXT', required: false },
      '=1+1',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.v).toBe('=1+1');
  });

  it("does not strip or escape HTML-looking content — escaping is the export/render engine's job", () => {
    const result = validateFieldValue(
      { type: 'TEXT', required: false },
      '<script>alert(1)</script>',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.v).toBe('<script>alert(1)</script>');
  });

  it('defaults max length to 2000 per FRD §4.4', () => {
    expect(TEXT_DEFAULT_MAX_LENGTH).toBe(2000);
  });

  it('rejects text longer than the field maxLength', () => {
    const result = validateFieldValue(
      { type: 'TEXT', required: false, maxLength: 5 },
      '123456',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MAX_LENGTH_EXCEEDED');
  });

  it('rejects text longer than the default 2000 when no field maxLength is set', () => {
    const result = validateFieldValue(
      { type: 'TEXT', required: false },
      'a'.repeat(2001),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MAX_LENGTH_EXCEEDED');
  });
});

describe('validateFieldValue — DATE/TIME (integration with the ISO/time parsers)', () => {
  it('accepts a valid ISO date through the generic field validator', () => {
    const result = validateFieldValue(
      { type: 'DATE', required: false },
      '2026-10-09',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ t: 'DATE', v: '2026-10-09' });
  });

  it('rejects an invalid date through the generic field validator', () => {
    const result = validateFieldValue(
      { type: 'DATE', required: false },
      '2026-02-31',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DATE_INVALID');
  });

  it('accepts a valid time through the generic field validator', () => {
    const result = validateFieldValue(
      { type: 'TIME', required: false },
      '17:00',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ t: 'TIME', v: '17:00' });
  });

  it('rejects an invalid time through the generic field validator', () => {
    const result = validateFieldValue(
      { type: 'TIME', required: false },
      '25:80',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIME_INVALID');
  });
});

describe('parseIsoDate', () => {
  it('accepts a valid ISO date', () => {
    const result = parseIsoDate('2026-10-09');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iso).toBe('2026-10-09');
  });

  it('rejects 31/02 regardless of separator style', () => {
    const result = parseIsoDate('2026-02-31');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DATE_INVALID');
  });

  it('rejects a bare numeric string (no Excel-serial interpretation here)', () => {
    const result = parseIsoDate('12345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DATE_INVALID');
  });

  it('rejects a 2-digit year', () => {
    const result = parseIsoDate('26-10-09');
    expect(result.ok).toBe(false);
  });

  it('rejects a date missing the year', () => {
    const result = parseIsoDate('10-09');
    expect(result.ok).toBe(false);
  });

  it('accepts Feb 29 on a leap year', () => {
    const result = parseIsoDate('2028-02-29');
    expect(result.ok).toBe(true);
  });

  it('rejects Feb 29 on a non-leap year', () => {
    const result = parseIsoDate('2026-02-29');
    expect(result.ok).toBe(false);
  });
});

describe('parseLocalizedDate (dd/mm/yyyy, for typed/pasted input)', () => {
  it('accepts a valid dd/mm/yyyy date and normalizes to ISO', () => {
    const result = parseLocalizedDate('09/10/2026', 'dd/mm/yyyy');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iso).toBe('2026-10-09');
  });

  it('rejects 31/02/2026', () => {
    const result = parseLocalizedDate('31/02/2026', 'dd/mm/yyyy');
    expect(result.ok).toBe(false);
  });

  it('rejects a bare serial-looking number', () => {
    const result = parseLocalizedDate('45392', 'dd/mm/yyyy');
    expect(result.ok).toBe(false);
  });

  it('does not change the calendar day because of timezone (date-only, no Date object with local TZ)', () => {
    // Regression guard: a naive `new Date('2026-10-09')` interpreted in a
    // negative-UTC-offset timezone can shift to 2026-10-08. This engine must
    // never produce that.
    const result = parseLocalizedDate('09/10/2026', 'dd/mm/yyyy');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iso).toBe('2026-10-09');
  });
});

describe('parseTimeOfDay', () => {
  it('accepts a valid 24h time', () => {
    const result = parseTimeOfDay('17:00');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('17:00');
  });

  it('rejects an out-of-range hour:minute (25:80)', () => {
    const result = parseTimeOfDay('25:80');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIME_INVALID');
  });

  it('rejects a bare number (not a time structure)', () => {
    const result = parseTimeOfDay('1700');
    expect(result.ok).toBe(false);
  });

  it('accepts midnight and one-minute-to-midnight boundary', () => {
    expect(parseTimeOfDay('00:00').ok).toBe(true);
    expect(parseTimeOfDay('23:59').ok).toBe(true);
  });

  it('rejects hour 24 (not a valid 24h clock hour)', () => {
    const result = parseTimeOfDay('24:00');
    expect(result.ok).toBe(false);
  });
});
