import { describe, expect, it } from 'vitest';
import { normalizeInput, nowTime, toEditText, todayIso } from '../normalizeInput';
import type { EditableField } from '../normalizeInput';

const num = (over: Partial<EditableField> = {}): EditableField => ({ type: 'NUM', ...over });
const ok = (value: string | null) => ({ ok: true, value });

describe('normalizeInput — NUM (vi-VN)', () => {
  it.each([
    ['1234', '1234'],
    ['1234,5', '1234.5'],
    ['1.234,5', '1234.5'],
    ['1.234.567', '1234567'],
    ['-7', '-7'],
    ['-1.000,25', '-1000.25'],
    ['  42  ', '42'],
    ['0,5', '0.5'],
    ['1234.5', '1234.5'], // a 4-digit integer part cannot be a thousands group → decimal point
  ])('%s → %s', (typed, stored) => {
    expect(normalizeInput(num(), typed)).toEqual(ok(stored));
  });

  it('refuses an ambiguous lone dot instead of guessing', () => {
    const r = normalizeInput(num(), '1.234');
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.message).toContain('mơ hồ');
  });

  it.each(['abc', '1,2,3', '12e3', '1,', '--5'])('rejects %s', (typed) => {
    expect(normalizeInput(num(), typed).ok).toBe(false);
  });

  it('enforces the field scale without rounding', () => {
    expect(normalizeInput(num({ scale: 0 }), '3,5').ok).toBe(false);
    expect(normalizeInput(num({ scale: 1 }), '3,5')).toEqual(ok('3.5'));
  });

  it('enforces min and max', () => {
    expect(normalizeInput(num({ min: '0' }), '-1').ok).toBe(false);
    expect(normalizeInput(num({ max: '100' }), '101').ok).toBe(false);
    expect(normalizeInput(num({ min: '0', max: '100' }), '100')).toEqual(ok('100'));
  });

  it('keeps 18 significant digits', () => {
    expect(normalizeInput(num({ scale: 0 }), '9007199254740993')).toEqual(ok('9007199254740993'));
  });
});

describe('normalizeInput — DATE, TIME, TEXT', () => {
  const date: EditableField = { type: 'DATE' };
  it.each([
    ['04/07/2026', '2026-07-04'],
    ['4/7/2026', '2026-07-04'],
    ['04-07-2026', '2026-07-04'],
    ['04.07.2026', '2026-07-04'],
    ['2026-07-04', '2026-07-04'],
    ['29/02/2028', '2028-02-29'],
  ])('date %s → %s', (typed, stored) => {
    expect(normalizeInput(date, typed)).toEqual(ok(stored));
  });

  it.each(['31/02/2026', '29/02/2027', '04/07/26', '2026-13-01', 'hôm nay', '4/7'])(
    'date rejects %s',
    (typed) => {
      expect(normalizeInput(date, typed).ok).toBe(false);
    },
  );

  const time: EditableField = { type: 'TIME' };
  it.each([
    ['08:05', '08:05'],
    ['8:05', '08:05'],
    ['23:59', '23:59'],
    ['00:00', '00:00'],
  ])('time %s → %s', (typed, stored) => {
    expect(normalizeInput(time, typed)).toEqual(ok(stored));
  });
  it.each(['24:00', '12:60', '8h30', '12'])('time rejects %s', (typed) => {
    expect(normalizeInput(time, typed).ok).toBe(false);
  });

  it('text is kept exactly, including a leading "=" and surrounding spaces', () => {
    expect(normalizeInput({ type: 'TEXT' }, '=1+1')).toEqual(ok('=1+1'));
    expect(normalizeInput({ type: 'TEXT' }, '  xin chào  ')).toEqual(ok('  xin chào  '));
    expect(normalizeInput({ type: 'TEXT' }, 'dòng 1\ndòng 2')).toEqual(ok('dòng 1\ndòng 2'));
  });

  it('text honours its max length', () => {
    expect(normalizeInput({ type: 'TEXT', maxLength: 3 }, 'abcd').ok).toBe(false);
    expect(normalizeInput({ type: 'TEXT', maxLength: 4 }, 'abcd')).toEqual(ok('abcd'));
  });
});

describe('clearing', () => {
  it.each(['NUM', 'TEXT', 'DATE', 'TIME'] as const)('an empty %s clears the cell, even if required', (type) => {
    expect(normalizeInput({ type, required: true }, '')).toEqual(ok(null));
    expect(normalizeInput({ type, required: true }, '   ')).toEqual(ok(null));
  });
});

describe('toEditText — what the officer can type back', () => {
  it('numbers use a comma and no grouping', () => {
    expect(toEditText({ type: 'NUM' }, '1234.5')).toBe('1234,5');
    expect(toEditText({ type: 'NUM' }, '-7')).toBe('-7');
    expect(toEditText({ type: 'NUM' }, '1234567')).toBe('1234567');
  });
  it('dates are dd/mm/yyyy', () => {
    expect(toEditText({ type: 'DATE' }, '2026-07-04')).toBe('04/07/2026');
  });
  it('blank stays blank and text is untouched', () => {
    expect(toEditText({ type: 'NUM' }, null)).toBe('');
    expect(toEditText({ type: 'TEXT' }, 'xin chào')).toBe('xin chào');
    expect(toEditText({ type: 'TIME' }, '08:05')).toBe('08:05');
  });
  it('round trip: editing a stored value and confirming it changes nothing', () => {
    const cases: Array<[EditableField, string]> = [
      [{ type: 'NUM' }, '1234.5'],
      [{ type: 'NUM' }, '-0.0001'],
      [{ type: 'NUM' }, '123456789012'],
      [{ type: 'DATE' }, '2028-02-29'],
      [{ type: 'TIME' }, '23:59'],
      [{ type: 'TEXT' }, 'a\tb'],
    ];
    for (const [field, stored] of cases) {
      expect(normalizeInput(field, toEditText(field, stored))).toEqual(ok(stored));
    }
  });
});

describe('today / now in Vietnam time', () => {
  it('uses Asia/Ho_Chi_Minh, not the machine zone', () => {
    // 2026-12-31T20:00Z is already 1 January 2027, 03:00 in Ho Chi Minh City.
    const d = new Date('2026-12-31T20:00:00Z');
    expect(todayIso(d)).toBe('2027-01-01');
    expect(nowTime(d)).toBe('03:00');
  });
  it('midnight is 00:00, never 24:00', () => {
    expect(nowTime(new Date('2026-06-14T17:00:00Z'))).toBe('00:00');
  });
});
