import * as fs from 'fs';
import * as path from 'path';
import { OCR_FORM_FIELDS } from './khai-o-form.generated';
import { mayAiFill } from './chinh-sach-o';
import { FIELD_UNITS, fromVnd } from './unit-contract';

const SCHEMA = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

describe('unit contract for numeric fields', () => {
  it('declares VND for the loss amount and a plain count for victims', () => {
    expect(FIELD_UNITS['statistic.soTienBiThietHai']).toBe('VND');
    expect(FIELD_UNITS['statistic.soLuongBiHai']).toBe('COUNT');
  });

  it('every numeric field a model may fill has a declared unit', () => {
    const fillableNumbers = new Set(
      (['petition', 'incident', 'case'] as const).flatMap((entity) =>
        OCR_FORM_FIELDS[entity]
          .filter((f) => f.kind === 'number' && mayAiFill(f.field))
          .map((f) => f.field),
      ),
    );
    expect(fillableNumbers.size).toBeGreaterThan(0);
    const missing = [...fillableNumbers].filter((f) => !(f in FIELD_UNITS));
    expect(missing).toEqual([]);
  });

  it('the database column really stores VND, whatever the form caption says', () => {
    const lines = SCHEMA.split('\n').filter((l) =>
      /^\s*soTienBiThietHai\s/.test(l),
    );
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) expect(line).toContain('VND');
  });

  it('the form caption mentions millions: the trap this contract exists to prevent', () => {
    const caption = OCR_FORM_FIELDS.case.find(
      (f) => f.field === 'statistic.soTienBiThietHai',
    )?.caption;
    expect(caption).toContain('triệu');
  });

  it('converts a VND amount to the stored unit without scaling', () => {
    expect(fromVnd(495253647, 'VND')).toBe(495253647);
    expect(fromVnd(5500000, 'VND')).toBe(5500000);
  });

  it('refuses to convert a VND amount into a non-money unit', () => {
    expect(() => fromVnd(1, 'COUNT')).toThrow('not a money unit');
  });
});
