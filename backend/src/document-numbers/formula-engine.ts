type Resolvable = Date | string | number;

const DATE_PATTERNS: Record<string, (d: Date) => string> = {
  YYYY: (d) => String(d.getUTCFullYear()),
  YY: (d) => String(d.getUTCFullYear()).slice(-2),
  MM: (d) => String(d.getUTCMonth() + 1).padStart(2, '0'),
  DD: (d) => String(d.getUTCDate()).padStart(2, '0'),
  YYYYMM: (d) =>
    String(d.getUTCFullYear()) + String(d.getUTCMonth() + 1).padStart(2, '0'),
  YYYYMMDD: (d) =>
    String(d.getUTCFullYear()) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0'),
};

function isZeroPadPattern(pattern: string): boolean {
  return /^0+$/.test(pattern);
}

export function formatValue(value: Resolvable, pattern: string): string {
  if (pattern === '') {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  if (value instanceof Date) {
    const fn = DATE_PATTERNS[pattern];
    return fn ? fn(value) : value.toISOString();
  }

  if (typeof value === 'number' && isZeroPadPattern(pattern)) {
    return String(value).padStart(pattern.length, '0');
  }

  return String(value);
}
