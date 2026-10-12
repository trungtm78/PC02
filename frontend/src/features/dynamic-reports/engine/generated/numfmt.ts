import Decimal from 'decimal.js';

/**
 * Excel number-format display (G0). The entry grid must show a cell the way
 * the template's own `numFmt` would: `0.00`, `#,##0`, `0%`, `dd/mm/yyyy`,
 * the 4-section `0;-0;;@` seen in the real templates, `[Red]`, quoted
 * literals. Pure, no I/O; copied verbatim to the frontend.
 *
 * Locale is Vietnamese by default (decimal comma, dot thousands separator),
 * matching the Excel the officers use. A code this module does not
 * implement (scientific, fractions, conditions, elapsed time) is shown in
 * General and reported in `warnings`, never rendered wrongly and silently.
 */

export type DisplayValue =
  | { type: 'blank' }
  /** Canonical decimal string. With a date/time format it is an Excel serial. */
  | { type: 'number'; value: string }
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  /** 'YYYY-MM-DD' */
  | { type: 'date'; value: string }
  /** 'HH:mm' */
  | { type: 'time'; value: string };

export interface DisplayOptions {
  locale?: 'vi' | 'en';
  /** Excel date system of the workbook (`DynReportVersion.dateSystem`). */
  dateSystem?: 1900 | 1904;
}

export interface FormattedCell {
  text: string;
  /** CSS colour from a `[Red]`-style section prefix. */
  color?: string;
  /** Excel's default horizontal alignment for the value type. */
  align: 'left' | 'right' | 'center';
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Format code parsing
// ---------------------------------------------------------------------------

type Token =
  | { t: 'lit'; s: string }
  | { t: 'digit'; ch: '0' | '#' | '?' }
  | { t: 'point' }
  | { t: 'comma' }
  | { t: 'pct' }
  | { t: 'at' }
  | { t: 'date'; code: string }
  | { t: 'ampm'; long: boolean };

interface Section {
  tokens: Token[];
  color?: string;
  isDate: boolean;
  hasText: boolean;
  /** A feature this module does not implement was seen. */
  unsupported: string | null;
}

const COLOURS: Record<string, string> = {
  black: '#000000',
  blue: '#0000ff',
  cyan: '#00ffff',
  green: '#008000',
  magenta: '#ff00ff',
  red: '#ff0000',
  white: '#ffffff',
  yellow: '#ffff00',
};

/** Splits on `;` that is outside quotes and brackets. */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let inBracket = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\\' && !inQuote) {
      cur += c + (code[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"') inQuote = !inQuote;
    else if (!inQuote && c === '[') inBracket = true;
    else if (!inQuote && c === ']') inBracket = false;
    if (c === ';' && !inQuote && !inBracket) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** True when the section, ignoring quoted text/brackets/escapes, uses a date or time letter. */
function looksLikeDate(section: string): boolean {
  let stripped = '';
  let inQuote = false;
  let inBracket = false;
  for (let i = 0; i < section.length; i++) {
    const c = section[i];
    if (c === '\\' && !inQuote) {
      i++;
      continue;
    }
    if (c === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (c === '[') {
      inBracket = true;
      continue;
    }
    if (c === ']') {
      inBracket = false;
      continue;
    }
    if (inBracket) continue;
    stripped += c;
  }
  return /[ydhsm]/i.test(stripped);
}

function parseSection(raw: string): Section {
  const isDate = looksLikeDate(raw);
  const tokens: Token[] = [];
  const section: Section = {
    tokens,
    isDate,
    hasText: false,
    unsupported: null,
  };
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"') {
      const end = raw.indexOf('"', i + 1);
      const s = end === -1 ? raw.slice(i + 1) : raw.slice(i + 1, end);
      tokens.push({ t: 'lit', s });
      i = end === -1 ? raw.length : end + 1;
      continue;
    }
    if (c === '\\') {
      if (i + 1 < raw.length) tokens.push({ t: 'lit', s: raw[i + 1] });
      i += 2;
      continue;
    }
    if (c === '_') {
      tokens.push({ t: 'lit', s: ' ' });
      i += 2;
      continue;
    }
    if (c === '*') {
      i += 2; // repeat-fill: cell width is not modelled
      continue;
    }
    if (c === '[') {
      const end = raw.indexOf(']', i);
      const inner = end === -1 ? raw.slice(i + 1) : raw.slice(i + 1, end);
      i = end === -1 ? raw.length : end + 1;
      const lower = inner.toLowerCase();
      if (COLOURS[lower]) {
        section.color = COLOURS[lower];
      } else if (/^color\d+$/.test(lower)) {
        // Palette index: not mapped.
      } else if (/^[<>=]/.test(inner)) {
        section.unsupported = 'điều kiện trong mã định dạng';
      } else if (inner.startsWith('$')) {
        const symbol = inner.slice(1).split('-')[0];
        if (symbol) tokens.push({ t: 'lit', s: symbol });
      } else if (/^(h+|m+|s+)$/.test(lower)) {
        section.unsupported = 'thời gian tích luỹ ([h]:mm)';
      }
      continue;
    }
    if (isDate) {
      if (/[ydhsm]/i.test(c)) {
        let j = i;
        while (j < raw.length && raw[j].toLowerCase() === c.toLowerCase()) j++;
        tokens.push({ t: 'date', code: raw.slice(i, j).toLowerCase() });
        i = j;
        continue;
      }
      const rest = raw.slice(i).toUpperCase();
      if (rest.startsWith('AM/PM')) {
        tokens.push({ t: 'ampm', long: true });
        i += 5;
        continue;
      }
      if (rest.startsWith('A/P')) {
        tokens.push({ t: 'ampm', long: false });
        i += 3;
        continue;
      }
      if (c === '.' && /^\.0+/.test(raw.slice(i))) {
        section.unsupported = 'giây lẻ (ss.000)';
      }
      tokens.push({ t: 'lit', s: c });
      i++;
      continue;
    }
    if (c === '0' || c === '#' || c === '?') {
      tokens.push({ t: 'digit', ch: c });
    } else if (c === '.') {
      tokens.push({ t: 'point' });
    } else if (c === ',') {
      tokens.push({ t: 'comma' });
    } else if (c === '%') {
      tokens.push({ t: 'pct' });
    } else if (c === '@') {
      section.hasText = true;
      tokens.push({ t: 'at' });
    } else if ((c === 'E' || c === 'e') && /[+-]/.test(raw[i + 1] ?? '')) {
      section.unsupported = 'ký hiệu khoa học (0.00E+00)';
      i += 2;
      continue;
    } else if (c === '/' && tokens.some((t) => t.t === 'digit')) {
      section.unsupported = 'phân số (# ?/?)';
      tokens.push({ t: 'lit', s: c });
    } else {
      tokens.push({ t: 'lit', s: c });
    }
    i++;
  }
  return section;
}

// ---------------------------------------------------------------------------
// Number rendering
// ---------------------------------------------------------------------------

interface Separators {
  decimal: string;
  thousands: string;
}

function separatorsOf(locale: 'vi' | 'en'): Separators {
  return locale === 'en'
    ? { decimal: '.', thousands: ',' }
    : { decimal: ',', thousands: '.' };
}

function groupDigits(digits: string, sep: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) out += sep;
  }
  return out;
}

/** Digit placeholders and literals around them → text for `abs` (a non-negative Decimal). */
function renderNumber(abs: Decimal, tokens: Token[], seps: Separators): string {
  // Percent signs scale; trailing commas (after the last placeholder) divide by 1000 each.
  const pctCount = tokens.filter((t) => t.t === 'pct').length;
  let value = abs.times(new Decimal(100).pow(pctCount));

  const lastDigit = tokens.map((t) => t.t).lastIndexOf('digit');
  let scale = 0;
  for (let i = lastDigit + 1; i < tokens.length; i++) {
    if (tokens[i].t === 'comma') scale++;
    else if (tokens[i].t === 'lit' || tokens[i].t === 'pct') continue;
    else if (tokens[i].t === 'point') break;
  }
  // A comma between two placeholders groups thousands; only trailing ones scale.
  const firstDigit = tokens.map((t) => t.t).indexOf('digit');
  const hasThousands = tokens.some(
    (t, idx) => t.t === 'comma' && idx > firstDigit && idx < lastDigit,
  );
  if (scale > 0) value = value.dividedBy(new Decimal(1000).pow(scale));

  const pointIdx = tokens.findIndex((t) => t.t === 'point');
  const intTokens = pointIdx === -1 ? tokens : tokens.slice(0, pointIdx);
  const fracTokens = pointIdx === -1 ? [] : tokens.slice(pointIdx + 1);
  const fracPlaces = fracTokens.filter((t) => t.t === 'digit').length;

  // Excel rounds half away from zero.
  const rounded = value.toDecimalPlaces(fracPlaces, Decimal.ROUND_HALF_UP);
  const fixed = rounded.toFixed(fracPlaces);
  const [intPartRaw, fracPartRaw = ''] = fixed.split('.');
  let intDigits = intPartRaw === '0' ? '' : intPartRaw;

  const intPlaceholders = intTokens.filter((t) => t.t === 'digit').length;

  // ---- integer side ------------------------------------------------------
  let intOut: string[]; // one rendered piece per int token, in order
  if (hasThousands) {
    // Group the padded digit run, keep the literals where they are.
    const zeros = intTokens.filter((t) => t.t === 'digit' && t.ch === '0').length;
    const padded = intDigits.padStart(zeros, '0');
    const grouped = groupDigits(padded, seps.thousands);
    const parts: string[] = [];
    let placed = false;
    for (const tk of intTokens) {
      if (tk.t === 'digit') {
        if (!placed) {
          parts.push(grouped);
          placed = true;
        } else {
          parts.push('');
        }
      } else if (tk.t === 'lit') parts.push(tk.s);
      else if (tk.t === 'pct') parts.push('%');
      else parts.push('');
    }
    intOut = parts;
  } else {
    const parts: string[] = new Array(intTokens.length).fill('');
    const digitIdx: number[] = [];
    intTokens.forEach((tk, idx) => {
      if (tk.t === 'digit') digitIdx.push(idx);
    });
    for (let d = digitIdx.length - 1; d >= 0; d--) {
      const idx = digitIdx[d];
      const tk = intTokens[idx] as Extract<Token, { t: 'digit' }>;
      if (intDigits.length > 0) {
        if (d === 0) {
          parts[idx] = intDigits; // leftmost placeholder takes every remaining digit
          intDigits = '';
        } else {
          parts[idx] = intDigits[intDigits.length - 1];
          intDigits = intDigits.slice(0, -1);
        }
      } else if (tk.ch === '0') {
        parts[idx] = '0';
      } else if (tk.ch === '?') {
        parts[idx] = ' ';
      }
    }
    intTokens.forEach((tk, idx) => {
      if (tk.t === 'lit') parts[idx] = tk.s;
      else if (tk.t === 'pct') parts[idx] = '%';
    });
    if (intPlaceholders === 0 && intDigits.length > 0) {
      // `.00` with 12.5: digits still need a home before the point.
      parts.push(intDigits);
    }
    intOut = parts;
  }

  // ---- fractional side ---------------------------------------------------
  let fracOut = '';
  if (pointIdx !== -1) {
    const f = fracPartRaw.padEnd(fracPlaces, '0');
    const pieces: string[] = [];
    let digitNo = 0;
    for (const tk of fracTokens) {
      if (tk.t === 'digit') {
        pieces.push(f[digitNo] ?? '0');
        digitNo++;
      } else if (tk.t === 'lit') pieces.push(tk.s);
      else if (tk.t === 'pct') pieces.push('%');
      else pieces.push('');
    }
    // Trailing '#' / '?' placeholders that hold a zero disappear; a '0' never does.
    const digitAt: number[] = [];
    fracTokens.forEach((tk, idx) => {
      if (tk.t === 'digit') digitAt.push(idx);
    });
    for (let d = digitAt.length - 1; d >= 0; d--) {
      const idx = digitAt[d];
      const tk = fracTokens[idx] as Extract<Token, { t: 'digit' }>;
      if (tk.ch !== '0' && f[d] === '0') pieces[idx] = tk.ch === '?' ? ' ' : '';
      else break;
    }    fracOut = seps.decimal + pieces.join('');
  }

  // Literals that sit before/after the whole numeric run keep their order.
  return intOut.join('') + fracOut;
}

// ---------------------------------------------------------------------------
// Date rendering
// ---------------------------------------------------------------------------

interface DateParts {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
  second: number;
}

const WEEKDAY_LONG_VI = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const WEEKDAY_SHORT_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LONG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Excel serial → calendar parts. 1900 system keeps Excel's fictitious 29/02/1900 (serial 60). */
function partsFromSerial(serial: Decimal, system: 1900 | 1904): DateParts | null {
  if (serial.isNegative()) return null;
  const whole = serial.floor();
  const fraction = serial.minus(whole);
  const seconds = fraction.times(86400).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  let days = whole.toNumber();
  let epochMs: number;
  if (system === 1904) {
    epochMs = Date.UTC(1904, 0, 1) + days * 86400000;
  } else {
    if (days === 60) {
      // The day Excel believes existed.
      return {
        year: 1900, month: 2, day: 29, weekday: 3,
        hour: Math.floor(seconds / 3600) % 24,
        minute: Math.floor(seconds / 60) % 60,
        second: seconds % 60,
      };
    }
    if (days > 60) days -= 1;
    epochMs = Date.UTC(1899, 11, 31) + days * 86400000;
  }
  const d = new Date(epochMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: Math.floor(seconds / 3600) % 24,
    minute: Math.floor(seconds / 60) % 60,
    second: seconds % 60,
  };
}

function partsFromIso(iso: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day, weekday: d.getUTCDay(), hour: 0, minute: 0, second: 0 };
}

function partsFromTime(hhmm: string): DateParts | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { year: 1900, month: 1, day: 0, weekday: 6, hour, minute, second: 0 };
}

function renderDate(tokens: Token[], p: DateParts, locale: 'vi' | 'en'): string {
  const hasAmPm = tokens.some((t) => t.t === 'ampm');
  // `m` is a minute when it follows an hour or precedes seconds; otherwise a month.
  const isMinute = (idx: number): boolean => {
    for (let b = idx - 1; b >= 0; b--) {
      const t = tokens[b];
      if (t.t === 'date') return t.code[0] === 'h';
      if (t.t === 'ampm') continue;
    }
    for (let a = idx + 1; a < tokens.length; a++) {
      const t = tokens[a];
      if (t.t === 'date') return t.code[0] === 's';
    }
    return false;
  };
  let out = '';
  tokens.forEach((t, idx) => {
    if (t.t === 'lit') {
      out += t.s;
    } else if (t.t === 'ampm') {
      const am = p.hour < 12;
      out += t.long ? (am ? 'AM' : 'PM') : am ? 'A' : 'P';
    } else if (t.t === 'date') {
      const c = t.code[0];
      const n = t.code.length;
      if (c === 'y') {
        out += n <= 2 ? pad(p.year % 100, 2) : pad(p.year, 4);
      } else if (c === 'm') {
        if (isMinute(idx)) {
          out += n >= 2 ? pad(p.minute, 2) : String(p.minute);
        } else if (n === 1) out += String(p.month);
        else if (n === 2) out += pad(p.month, 2);
        else if (n === 3) out += locale === 'vi' ? `Thg ${p.month}` : MONTH_SHORT_EN[p.month - 1];
        else out += locale === 'vi' ? `Tháng ${p.month}` : MONTH_LONG_EN[p.month - 1];
      } else if (c === 'd') {
        if (n === 1) out += String(p.day);
        else if (n === 2) out += pad(p.day, 2);
        else if (n === 3) out += locale === 'vi' ? WEEKDAY_SHORT_VI[p.weekday] : WEEKDAY_SHORT_EN[p.weekday];
        else out += locale === 'vi' ? WEEKDAY_LONG_VI[p.weekday] : WEEKDAY_LONG_EN[p.weekday];
      } else if (c === 'h') {
        const h = hasAmPm ? p.hour % 12 || 12 : p.hour;
        out += n >= 2 ? pad(h, 2) : String(h);
      } else if (c === 's') {
        out += n >= 2 ? pad(p.second, 2) : String(p.second);
      }
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

/**
 * Excel's General format fits a value in 11 characters (digits and the
 * decimal point; the sign is extra): 0,333333333 and 1234,56789. A value
 * that cannot fit — twelve or more integer digits, or one that would round to
 * zero — switches to scientific notation.
 */
function formatGeneral(value: Decimal, seps: Separators): string {
  if (value.isZero()) return '0';
  const abs = value.abs();
  const integerDigits = abs.gte(1) ? abs.floor().toFixed().length : 0;
  const places = integerDigits === 0 ? 9 : Math.max(0, 10 - integerDigits);
  const rounded = abs.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  if (integerDigits > 11 || rounded.isZero()) {
    const e = abs.toExponential(5).replace(/\.?0+e/, 'e');
    const [mant, exp] = e.split('e');
    const expNum = Number(exp);
    const sign = expNum < 0 ? '-' : '+';
    const text = `${mant.replace('.', seps.decimal)}E${sign}${pad(Math.abs(expNum), 2)}`;
    return value.isNegative() ? `-${text}` : text;
  }
  const body = rounded.toFixed().replace('.', seps.decimal);
  return value.isNegative() ? `-${body}` : body;
}
function generalFor(value: DisplayValue, seps: Separators, locale: 'vi' | 'en'): FormattedCell {
  switch (value.type) {
    case 'blank':
      return { text: '', align: 'left', warnings: [] };
    case 'text':
      return { text: value.value, align: 'left', warnings: [] };
    case 'boolean':
      return { text: value.value ? 'TRUE' : 'FALSE', align: 'center', warnings: [] };
    case 'number': {
      let d: Decimal;
      try {
        d = new Decimal(value.value);
      } catch {
        return { text: value.value, align: 'left', warnings: [] };
      }
      return { text: formatGeneral(d, seps), align: 'right', warnings: [] };
    }
    case 'date': {
      const p = partsFromIso(value.value);
      return {
        text: p ? renderDate(parseSection('dd/mm/yyyy').tokens, p, locale) : value.value,
        align: 'right',
        warnings: [],
      };
    }
    case 'time': {
      const p = partsFromTime(value.value);
      return {
        text: p ? renderDate(parseSection('hh:mm').tokens, p, locale) : value.value,
        align: 'right',
        warnings: [],
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function formatForDisplay(
  value: DisplayValue,
  numFmt: string | null | undefined,
  options: DisplayOptions = {},
): FormattedCell {
  const locale = options.locale ?? 'vi';
  const seps = separatorsOf(locale);
  const code = (numFmt ?? '').trim();

  if (value.type === 'blank') return { text: '', align: 'left', warnings: [] };
  if (code === '' || code.toLowerCase() === 'general') {
    return generalFor(value, seps, locale);
  }

  const rawSections = splitSections(code);
  const sections = rawSections.map(parseSection);
  const unsupported = sections.find((s) => s.unsupported)?.unsupported ?? null;
  if (unsupported) {
    const general = generalFor(value, seps, locale);
    general.warnings.push(`Mã định dạng "${code}" dùng ${unsupported} — hiển thị theo General.`);
    return general;
  }

  // ---- text ----------------------------------------------------------------
  if (value.type === 'text') {
    const textSection =
      sections.length >= 4
        ? sections[3]
        : sections.length === 1 && sections[0].hasText
          ? sections[0]
          : null;
    if (!textSection) return { text: value.value, align: 'left', warnings: [] };
    return {
      text: textSection.tokens
        .map((t) => (t.t === 'at' ? value.value : t.t === 'lit' ? t.s : ''))
        .join(''),
      color: textSection.color,
      align: 'left',
      warnings: [],
    };
  }

  if (value.type === 'boolean') return generalFor(value, seps, locale);

  // ---- date / time ---------------------------------------------------------
  const pickDateSection = (): Section | undefined => sections.find((s) => s.isDate);

  if (value.type === 'date' || value.type === 'time') {
    const section = pickDateSection();
    const parts = value.type === 'date' ? partsFromIso(value.value) : partsFromTime(value.value);
    if (!parts) return generalFor(value, seps, locale);
    if (!section) return generalFor(value, seps, locale);
    return {
      text: renderDate(section.tokens, parts, locale),
      color: section.color,
      align: 'right',
      warnings: [],
    };
  }

  // value.type === 'number'
  let d: Decimal;
  try {
    d = new Decimal(value.value);
  } catch {
    return { text: value.value, align: 'left', warnings: [] };
  }

  const isNegative = d.isNegative() && !d.isZero();
  let chosen: Section;
  let autoMinus = false;
  if (sections.length === 1) {
    chosen = sections[0];
    autoMinus = isNegative;
  } else if (sections.length === 2) {
    chosen = isNegative ? sections[1] : sections[0];
  } else {
    chosen = isNegative ? sections[1] : d.isZero() ? sections[2] : sections[0];
  }

  if (chosen.isDate) {
    if (isNegative) return { text: '#####', align: 'right', warnings: [] };
    const parts = partsFromSerial(d, options.dateSystem ?? 1900);
    if (!parts) return { text: '#####', align: 'right', warnings: [] };
    return {
      text: renderDate(chosen.tokens, parts, locale),
      color: chosen.color,
      align: 'right',
      warnings: [],
    };
  }

  if (chosen.tokens.length === 0) {
    // An empty section (e.g. the zero section of `0;-0;;@`) shows nothing.
    return { text: '', color: chosen.color, align: 'right', warnings: [] };
  }

  const body = renderNumber(d.abs(), chosen.tokens, seps);
  return {
    text: autoMinus ? `-${body}` : body,
    color: chosen.color,
    align: 'right',
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Formula errors
// ---------------------------------------------------------------------------

export type FormulaErrorCode =
  | 'DIV_BY_ZERO'
  | 'MISSING_DATA'
  | 'OUT_OF_SCOPE_REFERENCE'
  | 'CYCLE_DETECTED'
  | 'NOT_FOUND_REFERENCE'
  | 'STEP_LIMIT_EXCEEDED'
  | 'TYPE_ERROR';

/**
 * What a failed formula cell shows: the Excel error literal the officers
 * already know, plus a Vietnamese hint for the tooltip. Missing data is not
 * an Excel concept (Excel would silently use 0); the aggregate view shows it
 * in words instead, per D05 ("Thiếu dữ liệu để tính").
 */
export function describeFormulaError(code: FormulaErrorCode): { text: string; hint: string } {
  switch (code) {
    case 'DIV_BY_ZERO':
      return { text: '#DIV/0!', hint: 'Không tính được: chia cho 0.' };
    case 'TYPE_ERROR':
      return { text: '#VALUE!', hint: 'Giá trị không đúng kiểu để tính.' };
    case 'NOT_FOUND_REFERENCE':
      return { text: '#REF!', hint: 'Địa chỉ ô không tồn tại trong mẫu.' };
    case 'OUT_OF_SCOPE_REFERENCE':
      return { text: '#REF!', hint: 'Ô tham chiếu nằm ngoài phạm vi báo cáo.' };
    case 'CYCLE_DETECTED':
      return { text: '#REF!', hint: 'Công thức tham chiếu vòng lặp.' };
    case 'STEP_LIMIT_EXCEEDED':
      return { text: '#NUM!', hint: 'Công thức quá lớn để tính.' };
    case 'MISSING_DATA':
      return { text: 'Thiếu dữ liệu', hint: 'Thiếu dữ liệu để tính.' };
  }
}
