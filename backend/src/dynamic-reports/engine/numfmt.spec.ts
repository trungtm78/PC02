import { describeFormulaError, formatForDisplay } from './numfmt';
import type { DisplayValue } from './numfmt';

/**
 * Number-format display. Every expected string is written by hand from how
 * Excel (Vietnamese locale: decimal comma, dot thousands) renders the same
 * cell, not produced by running numfmt.ts.
 */

const num = (value: string): DisplayValue => ({ type: 'number', value });
const text = (value: string): DisplayValue => ({ type: 'text', value });
const show = (v: DisplayValue, fmt: string | null | undefined, opts = {}) =>
  formatForDisplay(v, fmt, opts).text;

describe('General', () => {
  it.each([
    ['5', '5'],
    ['-5', '-5'],
    ['1234.5', '1234,5'],
    ['0.1', '0,1'],
    ['0', '0'],
    ['12345678901', '12345678901'], // 11 digits: still plain
    ['0.333333333333', '0,333333333'], // 11 characters: 0 , and nine digits
    ['1234.56789012345', '1234,56789'], // 10 integer+decimal digits left after the point
    ['0.5', '0,5'],
    ['-0.25', '-0,25'],
    ['0.000012345', '0,000012345'],
  ])('%s → %s', (input, expected) => {
    expect(show(num(input), 'General')).toBe(expected);
    expect(show(num(input), undefined)).toBe(expected);
    expect(show(num(input), '')).toBe(expected);
  });

  it('switches to scientific notation beyond 11 integer digits, like Excel', () => {
    expect(show(num('123456789012'), 'General')).toBe('1,23457E+11');
  });

  it('and for a value too small to show in 11 characters', () => {
    expect(show(num('0.00000000012345'), 'General')).toBe('1,2345E-10');
  });

  it('text and booleans', () => {
    expect(show(text('Tổ 3'), 'General')).toBe('Tổ 3');
    expect(show({ type: 'boolean', value: true }, 'General')).toBe('TRUE');
    expect(show({ type: 'blank' }, '0.00')).toBe('');
  });
});

describe('plain digit formats', () => {
  it.each([
    ['0', '5', '5'],
    ['0', '5.5', '6'], // half rounds away from zero
    ['0', '2.5', '3'],
    ['0', '-2.5', '-3'],
    ['0', '0.4', '0'],
    ['00', '5', '05'],
    ['000', '7', '007'],
    ['0.0', '5', '5,0'],
    ['0.00', '1234.567', '1234,57'],
    ['0.00', '0.005', '0,01'],
    ['0.00', '-1.5', '-1,50'],
    ['#', '0', ''],
    ['#', '5', '5'],
    ['#.##', '5', '5,'],
    ['#.##', '5.5', '5,5'],
    ['#.##', '5.25', '5,25'],
    ['0.##', '5', '5,'],
    ['0.##', '5.1', '5,1'],
    ['?.?', '5', '5, '],
  ])('format %s on %s → %s', (fmt, input, expected) => {
    expect(show(num(input), fmt)).toBe(expected);
  });

  it('a leftmost placeholder swallows every extra integer digit', () => {
    expect(show(num('123456'), '0')).toBe('123456');
    expect(show(num('12345'), '00')).toBe('12345');
  });

  it('a value with no integer placeholder still shows its integer digits', () => {
    expect(show(num('12.5'), '.00')).toBe('12,50');
  });

  it('interleaved literals: 000-0000 for a phone-like number', () => {
    expect(show(num('1234567'), '000-0000')).toBe('123-4567');
    expect(show(num('42'), '000-0000')).toBe('000-0042');
  });
});

describe('thousands separator', () => {
  it.each([
    ['#,##0', '0', '0'],
    ['#,##0', '999', '999'],
    ['#,##0', '1000', '1.000'],
    ['#,##0', '1234567', '1.234.567'],
    ['#,##0', '-1234567', '-1.234.567'],
    ['#,##0.00', '1234.5', '1.234,50'],
    ['#,##0.00', '1234567.891', '1.234.567,89'],
    ['#,##0.00', '0.5', '0,50'],
    ['#,###', '1234', '1.234'],
    ['#,###', '0', ''],
  ])('format %s on %s → %s', (fmt, input, expected) => {
    expect(show(num(input), fmt)).toBe(expected);
  });

  it('English locale swaps the separators', () => {
    expect(show(num('1234567.5'), '#,##0.00', { locale: 'en' })).toBe('1,234,567.50');
  });

  it('a trailing comma scales by a thousand', () => {
    expect(show(num('1234567'), '0,')).toBe('1235');
    expect(show(num('1234567'), '#,##0,')).toBe('1.235');
  });
});

describe('percent', () => {
  it.each([
    ['0%', '0.5', '50%'],
    ['0%', '0.256', '26%'],
    ['0.0%', '0.256', '25,6%'],
    ['0.00%', '1', '100,00%'],
    ['0%', '-0.1', '-10%'],
    ['0%', '0', '0%'],
  ])('format %s on %s → %s', (fmt, input, expected) => {
    expect(show(num(input), fmt)).toBe(expected);
  });
});

describe('literals, escapes and currency', () => {
  it.each([
    ['0" vụ"', '5', '5 vụ'],
    ['"Tổng: "0', '12', 'Tổng: 12'],
    ['#,##0 "đ"', '1500000', '1.500.000 đ'],
    ['0\\ "kg"', '3', '3 kg'],
    ['0_)', '5', '5 '],
    ['[$₫-42A]#,##0', '25000', '₫25.000'],
    ['0 "người"', '-3', '-3 người'],
  ])('format %s on %s → %s', (fmt, input, expected) => {
    expect(show(num(input), fmt)).toBe(expected);
  });
});

describe('multi-section formats', () => {
  it('0;-0;;@ — the shape found in the real templates: zero shows nothing', () => {
    const fmt = '0;-0;;@';
    expect(show(num('5'), fmt)).toBe('5');
    expect(show(num('-5'), fmt)).toBe('-5');
    expect(show(num('0'), fmt)).toBe('');
    expect(show(text('abc'), fmt)).toBe('abc');
  });

  it('two sections: the negative section has its own look and no automatic minus', () => {
    const fmt = '0.00;(0.00)';
    expect(show(num('5'), fmt)).toBe('5,00');
    expect(show(num('-5'), fmt)).toBe('(5,00)');
    expect(show(num('0'), fmt)).toBe('0,00');
  });

  it('three sections: positive; negative; zero', () => {
    const fmt = '#,##0;-#,##0;"—"';
    expect(show(num('1500'), fmt)).toBe('1.500');
    expect(show(num('-1500'), fmt)).toBe('-1.500');
    expect(show(num('0'), fmt)).toBe('—');
  });

  it('the fourth section formats text around @', () => {
    expect(show(text('Tổ 2'), '0;-0;0;"Đội: "@')).toBe('Đội: Tổ 2');
  });

  it('a lone @ section returns text unchanged', () => {
    expect(show(text('abc'), '@')).toBe('abc');
  });

  it('a semicolon inside a quoted literal is not a section break', () => {
    expect(show(num('5'), '0"; "')).toBe('5; ');
  });
});

describe('colour sections', () => {
  it('[Red] sets the colour and does not print', () => {
    const r = formatForDisplay(num('-5'), '0;[Red]-0');
    expect(r.text).toBe('-5');
    expect(r.color).toBe('#ff0000');
    expect(formatForDisplay(num('5'), '0;[Red]-0').color).toBeUndefined();
  });

  it('[Blue] in the positive section', () => {
    expect(formatForDisplay(num('5'), '[Blue]0').color).toBe('#0000ff');
  });
});

describe('alignment follows the value type', () => {
  it('numbers right, text left, booleans centred', () => {
    expect(formatForDisplay(num('1'), '0').align).toBe('right');
    expect(formatForDisplay(text('a'), 'General').align).toBe('left');
    expect(formatForDisplay({ type: 'boolean', value: false }, 'General').align).toBe('center');
  });
});

describe('dates and times', () => {
  const iso = (value: string): DisplayValue => ({ type: 'date', value });
  const hm = (value: string): DisplayValue => ({ type: 'time', value });

  it.each([
    ['dd/mm/yyyy', '2026-10-12', '12/10/2026'],
    ['d/m/yyyy', '2026-03-05', '5/3/2026'],
    ['dd/mm/yy', '2026-10-12', '12/10/26'],
    ['yyyy-mm-dd', '2026-10-12', '2026-10-12'],
    ['dd "tháng" mm "năm" yyyy', '2026-10-12', '12 tháng 10 năm 2026'],
    ['dddd', '2026-10-12', 'Thứ Hai'],
    ['ddd', '2026-10-17', 'T7'],
    ['mmmm yyyy', '2026-10-12', 'Tháng 10 2026'],
  ])('ISO date, format %s on %s → %s', (fmt, input, expected) => {
    expect(show(iso(input), fmt)).toBe(expected);
  });

  it('an ISO date shown through General reads dd/mm/yyyy', () => {
    expect(show(iso('2026-10-12'), 'General')).toBe('12/10/2026');
  });

  it('an impossible date is shown as typed, not as a wrong date', () => {
    expect(show(iso('2026-02-31'), 'dd/mm/yyyy')).toBe('2026-02-31');
  });

  it.each([
    ['hh:mm', '09:05', '09:05'],
    ['h:mm', '09:05', '9:05'],
    ['hh:mm:ss', '23:59', '23:59:00'],
    ['hh:mm AM/PM', '14:30', '02:30 PM'],
    ['h:mm AM/PM', '00:15', '12:15 AM'],
  ])('time, format %s on %s → %s', (fmt, input, expected) => {
    expect(show(hm(input), fmt)).toBe(expected);
  });

  it('m is minutes next to h and months otherwise', () => {
    expect(show(hm('07:08'), 'h:m')).toBe('7:8');
    expect(show(iso('2026-08-09'), 'd/m')).toBe('9/8');
  });

  describe('Excel serial numbers (1900 system)', () => {
    it.each([
      ['1', '01/01/1900'],
      ['59', '28/02/1900'],
      ['60', '29/02/1900'], // the day Excel wrongly believes existed
      ['61', '01/03/1900'],
      ['36526', '01/01/2000'],
      ['46307', '12/10/2026'],
    ])('serial %s → %s', (serial, expected) => {
      expect(show(num(serial), 'dd/mm/yyyy')).toBe(expected);
    });

    it('the time of day comes from the fraction', () => {
      expect(show(num('46307.75'), 'dd/mm/yyyy hh:mm')).toBe('12/10/2026 18:00');
      expect(show(num('0.5'), 'hh:mm')).toBe('12:00');
    });

    it('a negative serial is #####', () => {
      expect(show(num('-1'), 'dd/mm/yyyy')).toBe('#####');
    });
  });

  it('the 1904 system counts from 01/01/1904', () => {
    expect(show(num('0'), 'dd/mm/yyyy', { dateSystem: 1904 })).toBe('01/01/1904');
    expect(show(num('44845'), 'dd/mm/yyyy', { dateSystem: 1904 })).toBe('12/10/2026');
  });
});

describe('codes that are not implemented fall back to General with a warning', () => {
  it.each([
    ['0.00E+00', 'ký hiệu khoa học'],
    ['# ?/?', 'phân số'],
    ['[>100]0;0', 'điều kiện'],
    ['[h]:mm', 'thời gian tích luỹ'],
    ['hh:mm:ss.000', 'giây lẻ'],
  ])('%s', (fmt, reason) => {
    const r = formatForDisplay(num('1234.5'), fmt);
    expect(r.text).toBe('1234,5');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain(reason);
  });
});

describe('describeFormulaError', () => {
  it.each([
    ['DIV_BY_ZERO', '#DIV/0!'],
    ['TYPE_ERROR', '#VALUE!'],
    ['NOT_FOUND_REFERENCE', '#REF!'],
    ['OUT_OF_SCOPE_REFERENCE', '#REF!'],
    ['CYCLE_DETECTED', '#REF!'],
    ['STEP_LIMIT_EXCEEDED', '#NUM!'],
    ['MISSING_DATA', 'Thiếu dữ liệu'],
  ] as const)('%s shows %s with a Vietnamese hint', (code, shown) => {
    const d = describeFormulaError(code);
    expect(d.text).toBe(shown);
    expect(d.hint.length).toBeGreaterThan(5);
  });
});
