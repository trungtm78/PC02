import * as fs from 'fs';
import * as path from 'path';

/**
 * The engine takes `now` and the calendar as parameters and must give the same answer in any process time zone. This
 * reads its source: no clock, no local-time `Date` method, no database, no framework.
 */
const sources = fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
  .map((name) => ({ name, text: fs.readFileSync(path.join(__dirname, name), 'utf8') }));

const FORBIDDEN: Array<[what: string, pattern: RegExp]> = [
  ['the clock (Date.now)', /Date\.now\s*\(/],
  ['the clock (new Date())', /new Date\(\s*\)/],
  ['a local-time getter', /\.get(?:FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds|TimezoneOffset)\s*\(/],
  ['a local-time setter', /\.set(?:FullYear|Month|Date|Hours|Minutes|Seconds|Milliseconds)\s*\(/],
  ['a locale format', /\.toLocale\w*\s*\(|Intl\./],
  ['a local-time constructor (new Date(y, m, ...))', /new Date\(\s*[\w.]+\s*,/],
  ['the database', /@prisma\/client|PrismaService/],
  ['the framework', /@nestjs\//],
];

describe('the engine is pure', () => {
  it('there are engine sources to read', () => {
    expect(sources.map((source) => source.name).sort()).toEqual(
      ['bands.ts', 'civil-day.ts', 'compute-due.ts', 'errors.ts', 'pauses.ts',
      'step-machine.ts', 'types.ts', 'working-calendar.ts'].sort(),
    );
  });

  it.each(FORBIDDEN)('no source uses %s', (_what, pattern) => {
    expect(sources.filter((source) => pattern.test(source.text)).map((source) => source.name)).toEqual([]);
  });

  it.each(FORBIDDEN.slice(0, 6))('the scan would see %s if it were there', (_what, pattern) => {
    const planted = ['Date.now()', 'new Date()', 'd.getDate()', 'd.setDate(1)', 'd.toLocaleDateString()', 'new Date(year, 0, 1)'];
    expect(planted.some((line) => pattern.test(line))).toBe(true);
    // The UTC forms the engine does use are not caught.
    for (const fine of ['d.getUTCDate()', 'd.getTime()', 'new Date(ms)', 'new Date(day * MS_PER_DAY)', 'Date.UTC(year, month, 0)']) {
      expect({ fine, caught: pattern.test(fine) }).toEqual({ fine, caught: false });
    }
  });
});
