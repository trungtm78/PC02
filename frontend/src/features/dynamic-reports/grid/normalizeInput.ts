import { DECIMAL_LIMITS, formatViVnDecimal, parseViVnDecimalInput } from '../engine/generated/decimal';
import { parseIsoDate, parseLocalizedDate, parseTimeOfDay, validateFieldValue } from '../engine/generated/values';
import type { FieldType } from '../engine/generated/values';
import Decimal from 'decimal.js';

/**
 * What an officer types into a grid cell, turned into the canonical string the
 * API stores — or a plain-language reason it cannot be. One entry point for
 * typing, pasting and the "today" shortcut, so the same text is judged the same
 * way everywhere (FRD §4.4: "dùng cùng quy tắc khi paste").
 *
 *   NUM   1.234,5 · 1234,5 · -7 → "1234.5" · "1234.5" · "-7" (a lone "1.234" is
 *         ambiguous and refused with a hint, never guessed)
 *   DATE  dd/mm/yyyy, d/m/yyyy, dd-mm-yyyy, dd.mm.yyyy or yyyy-mm-dd → "yyyy-mm-dd"
 *   TIME  H:mm or HH:mm → "HH:mm"
 *   TEXT  kept exactly as typed
 *
 * Clearing a cell is always allowed (required-ness is enforced at submit).
 */

export interface EditableField {
  type: FieldType;
  required?: boolean;
  min?: string | null;
  max?: string | null;
  scale?: number | null;
  maxLength?: number | null;
}

export type NormalizeResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

const SLASH_DATE_SEPARATORS = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/;

function constraintsOf(field: EditableField) {
  return {
    type: field.type,
    required: false,
    min: field.min ?? undefined,
    max: field.max ?? undefined,
    scale: field.scale ?? undefined,
    maxLength: field.maxLength ?? undefined,
  };
}

export function normalizeInput(field: EditableField, raw: string): NormalizeResult {
  const text = field.type === 'TEXT' ? raw : raw.trim();
  if (text.trim() === '') return { ok: true, value: null };

  switch (field.type) {
    case 'NUM': {
      const parsed = parseViVnDecimalInput(text, {
        MAX_PRECISION: DECIMAL_LIMITS.MAX_PRECISION,
        MAX_SCALE: field.scale ?? DECIMAL_LIMITS.MAX_SCALE,
      });
      if (!parsed.ok) return { ok: false, message: parsed.error.message };
      return fromValidation(validateFieldValue(constraintsOf(field), parsed.canonical));
    }
    case 'DATE': {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? parseIsoDate(text)
        : parseLocalizedDate(text.replace(SLASH_DATE_SEPARATORS, '$1/$2/$3'), 'dd/mm/yyyy');
      if (!iso.ok) return { ok: false, message: iso.error.message };
      return { ok: true, value: iso.iso };
    }
    case 'TIME': {
      const padded = /^\d:\d{2}$/.test(text) ? `0${text}` : text;
      const time = parseTimeOfDay(padded);
      if (!time.ok) return { ok: false, message: time.error.message };
      return { ok: true, value: time.value };
    }
    case 'TEXT':
      return fromValidation(validateFieldValue(constraintsOf(field), text));
  }
}

function fromValidation(result: ReturnType<typeof validateFieldValue>): NormalizeResult {
  return result.ok
    ? { ok: true, value: result.value.v }
    : { ok: false, message: result.error.message };
}

/**
 * The text an officer sees when a cell is opened for editing (and the text
 * copied to the clipboard): what they could type back and get the same value.
 * NUM uses a comma decimal and no grouping — "1234,5" — which Excel (vi-VN)
 * also reads as a number and which cannot be mistaken for a thousands group.
 */
export function toEditText(field: EditableField, stored: string | null | undefined): string {
  if (stored === null || stored === undefined || stored === '') return '';
  switch (field.type) {
    case 'NUM': {
      try {
        return formatViVnDecimal(new Decimal(stored)).replace(/\./g, '');
      } catch {
        return stored;
      }
    }
    case 'DATE': {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stored);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : stored;
    }
    default:
      return stored;
  }
}

/** Today in Asia/Ho_Chi_Minh as yyyy-mm-dd, for the Ctrl+; shortcut. */
export function todayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Current time in Asia/Ho_Chi_Minh as HH:mm, for the Ctrl+Shift+; shortcut. */
export function nowTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}`;
}
