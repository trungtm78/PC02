import Decimal from 'decimal.js';
import { DECIMAL_LIMITS, parseCanonicalDecimal } from './decimal';
import { isValidCalendarDate } from './date-math';

/**
 * Values engine — per-field validation for the four grammar types (FRD
 * §4.4). Pure, no I/O (spec §10 R2). Used identically on the client (before
 * sending a patch) and on the server (authoritative re-validation of every
 * patch, FRD §4.2: "Invalid input ở client không gửi; ... API vẫn validate
 * lại toàn bộ").
 *
 * Scope boundary: this engine validates and normalizes a single typed
 * value. It does NOT escape content for rendering (export engine's job,
 * reusing the existing escapeXlsxCell, AC-020) and it does NOT interpret
 * Excel serial-date numbers (the template parser's job when reading a
 * literal cell during import, PR3) — a bare numeric string typed into a
 * DATE field is just an invalid date format here, never auto-converted.
 */

export type FieldType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';

export interface FieldDefinitionLike {
  type: FieldType;
  required: boolean;
  /** NUM only — canonical decimal strings. */
  min?: string;
  max?: string;
  /** NUM only — overrides DECIMAL_LIMITS.MAX_SCALE for this field (e.g. 0 for quantities). */
  scale?: number;
  /** TEXT only. Defaults to TEXT_DEFAULT_MAX_LENGTH. */
  maxLength?: number;
}

export const TEXT_DEFAULT_MAX_LENGTH = 2000;

export type TypedValue =
  | { t: 'NUM'; v: string | null }
  | { t: 'TEXT'; v: string | null }
  | { t: 'DATE'; v: string | null }
  | { t: 'TIME'; v: string | null };

export type ValueValidationErrorCode =
  | 'REQUIRED'
  | 'OUT_OF_RANGE'
  | 'SCALE_EXCEEDED'
  | 'PRECISION_EXCEEDED'
  | 'MAX_LENGTH_EXCEEDED'
  | 'DATE_INVALID'
  | 'TIME_INVALID'
  | 'NOT_A_NUMBER'
  | 'AMBIGUOUS_SEPARATOR'
  | 'INFINITY_NOT_ALLOWED'
  | 'SCIENTIFIC_NOTATION_NOT_ALLOWED';

export interface ValueValidationError {
  code: ValueValidationErrorCode;
  message: string;
}

export type ValueValidationResult =
  | { ok: true; value: TypedValue }
  | { ok: false; error: ValueValidationError };

function err(
  code: ValueValidationErrorCode,
  message: string,
): ValueValidationResult {
  return { ok: false, error: { code, message } };
}

function isBlank(raw: string | null): boolean {
  return raw === null || raw === '';
}

function validateNum(
  field: FieldDefinitionLike,
  raw: string,
): ValueValidationResult {
  const limits = {
    MAX_PRECISION: DECIMAL_LIMITS.MAX_PRECISION,
    MAX_SCALE: field.scale ?? DECIMAL_LIMITS.MAX_SCALE,
  };
  const parsed = parseCanonicalDecimal(raw, limits);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  if (
    field.min !== undefined &&
    parsed.value.lessThan(new Decimal(field.min))
  ) {
    return err('OUT_OF_RANGE', `Giá trị nhỏ hơn mức tối thiểu ${field.min}.`);
  }
  if (
    field.max !== undefined &&
    parsed.value.greaterThan(new Decimal(field.max))
  ) {
    return err('OUT_OF_RANGE', `Giá trị lớn hơn mức tối đa ${field.max}.`);
  }

  return { ok: true, value: { t: 'NUM', v: parsed.canonical } };
}

function validateText(
  field: FieldDefinitionLike,
  raw: string,
): ValueValidationResult {
  const maxLength = field.maxLength ?? TEXT_DEFAULT_MAX_LENGTH;
  if (raw.length > maxLength) {
    return err('MAX_LENGTH_EXCEEDED', `Văn bản vượt quá ${maxLength} ký tự.`);
  }
  // Stored verbatim: no HTML escaping, no formula interpretation. AC-020.
  return { ok: true, value: { t: 'TEXT', v: raw } };
}

function validateDate(
  _field: FieldDefinitionLike,
  raw: string,
): ValueValidationResult {
  const parsed = parseIsoDate(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { t: 'DATE', v: parsed.iso } };
}

function validateTime(
  _field: FieldDefinitionLike,
  raw: string,
): ValueValidationResult {
  const parsed = parseTimeOfDay(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { t: 'TIME', v: parsed.value } };
}

/** Validates one raw input string (or null for "left blank") against a field's type and constraints. */
export function validateFieldValue(
  field: FieldDefinitionLike,
  raw: string | null,
): ValueValidationResult {
  if (isBlank(raw)) {
    if (field.required) {
      return err('REQUIRED', 'Ô này bắt buộc nhập.');
    }
    return { ok: true, value: { t: field.type, v: null } as TypedValue };
  }

  const value = raw as string;
  switch (field.type) {
    case 'NUM':
      return validateNum(field, value);
    case 'TEXT':
      return validateText(field, value);
    case 'DATE':
      return validateDate(field, value);
    case 'TIME':
      return validateTime(field, value);
  }
}

export type DateParseResult =
  | { ok: true; iso: string }
  | { ok: false; error: ValueValidationError };

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Strict ISO date-only parse (yyyy-mm-dd). Never constructs a JS `Date` from
 * the input and reads it back — that would apply the runtime's local
 * timezone and can shift the calendar day. All arithmetic here is on plain
 * integers; `Date.UTC` is used only internally, to compute days-in-month,
 * never to represent the parsed value itself.
 */
export function parseIsoDate(input: string): DateParseResult {
  const match = ISO_DATE_RE.exec(input.trim());
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'DATE_INVALID',
        message: `"${input}" không đúng định dạng ngày ISO (yyyy-mm-dd).`,
      },
    };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    return {
      ok: false,
      error: {
        code: 'DATE_INVALID',
        message: `Ngày "${input}" không tồn tại trên lịch.`,
      },
    };
  }
  return { ok: true, iso: input.trim() };
}

export type DateFormat = 'dd/mm/yyyy';

/**
 * Parses a user-typed or pasted date string in the field's configured
 * display format (FRD §4.4: dd/MM/yyyy and dd/mm/yyyy both normalize to the
 * same system date format) and returns the canonical ISO date-only string.
 */
export function parseLocalizedDate(
  input: string,
  format: DateFormat,
): DateParseResult {
  const trimmed = input.trim();
  if (format === 'dd/mm/yyyy') {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (!match) {
      return {
        ok: false,
        error: {
          code: 'DATE_INVALID',
          message: `"${input}" không đúng định dạng dd/mm/yyyy.`,
        },
      };
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return {
        ok: false,
        error: {
          code: 'DATE_INVALID',
          message: `Ngày "${input}" không tồn tại trên lịch.`,
        },
      };
    }
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { ok: true, iso };
  }
  return {
    ok: false,
    error: {
      code: 'DATE_INVALID',
      // Defensive guard: DateFormat currently has one member, so this is
      // dead code today — kept so a future added format that forgets to
      // extend the branch above fails loudly instead of silently.
      message: `Định dạng ngày "${String(format)}" chưa hỗ trợ.`,
    },
  };
}

export type TimeParseResult =
  | { ok: true; value: string }
  | { ok: false; error: ValueValidationError };

const TIME_RE = /^(\d{2}):(\d{2})$/;

/** Strict 24h HH:mm parse. Never interprets the value as a duration. */
export function parseTimeOfDay(input: string): TimeParseResult {
  const match = TIME_RE.exec(input.trim());
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'TIME_INVALID',
        message: `"${input}" không đúng định dạng giờ HH:mm.`,
      },
    };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return {
      ok: false,
      error: {
        code: 'TIME_INVALID',
        message: `Giờ "${input}" không hợp lệ (0-23 giờ, 0-59 phút).`,
      },
    };
  }
  return { ok: true, value: `${match[1]}:${match[2]}` };
}
