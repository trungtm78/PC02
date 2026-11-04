import { scoreCase, summarise, type GoldenCase } from './scorer';
import type { Projection } from '../projection';

const fill = (
  field: string,
  value: string | number,
  policy: 'AI_FILL' | 'AI_FILL_MUST_CONFIRM' = 'AI_FILL',
) => ({
  field,
  value,
  policy,
  provenance: { claimKind: 'QUOTED' as const, pageId: 'p1', quote: null },
  warnings: [],
});

const projection = (...fills: Projection['fills']): Projection => ({
  fills,
  skips: [],
});

const golden = (
  fields: GoldenCase['fields'],
  over: Partial<GoldenCase> = {},
): GoldenCase => ({
  id: 'g1',
  entity: 'petition',
  fields,
  ...over,
});

describe('scoreCase', () => {
  it('a field filled with the golden value is correct, with the policy it carried', () => {
    const r = scoreCase(
      golden({ tenCungCap: 'Nguyễn Thị Hương' }),
      projection(
        fill('tenCungCap', 'Nguyễn Thị Hương', 'AI_FILL_MUST_CONFIRM'),
      ),
    );
    expect(r.correct).toEqual(['tenCungCap']);
    expect(r.wrong).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.invented).toEqual([]);
  });

  it('compares text the way an officer would: case, spacing and Unicode form do not matter', () => {
    const nfd = 'Nguyễn'.normalize('NFD');
    const r = scoreCase(
      golden({ tenCungCap: 'Nguyễn  Thị Hương' }),
      projection(fill('tenCungCap', ` ${nfd.toUpperCase()} thị hương `)),
    );
    expect(r.correct).toEqual(['tenCungCap']);
  });

  it('numbers compare as numbers, with separators ignored', () => {
    const r = scoreCase(
      golden({ 'statistic.soTienBiThietHai': '495.253.647' }),
      projection(fill('statistic.soTienBiThietHai', 495253647)),
    );
    expect(r.correct).toEqual(['statistic.soTienBiThietHai']);
  });

  it('a field filled with another value is wrong; a field the golden has but the system left empty is missing', () => {
    const r = scoreCase(
      golden({ tenCungCap: 'Nguyễn Thị Hương', sdtCungCap: '0901234567' }),
      projection(fill('tenCungCap', 'Nguyễn Thị Hường')),
    );
    expect(r.wrong).toEqual([
      {
        field: 'tenCungCap',
        expected: 'Nguyễn Thị Hương',
        actual: 'Nguyễn Thị Hường',
      },
    ]);
    expect(r.missing).toEqual(['sdtCungCap']);
  });

  it('a field the golden says must stay EMPTY and was filled counts as invented: the worst kind of error', () => {
    const r = scoreCase(
      golden({ sdtCungCap: null }),
      projection(fill('sdtCungCap', '0901234567')),
    );
    expect(r.invented).toEqual([{ field: 'sdtCungCap', actual: '0901234567' }]);
    expect(r.correct).toEqual([]);
  });

  it('a golden empty field left empty is correct', () => {
    const r = scoreCase(golden({ sdtCungCap: null }), projection());
    expect(r.correct).toEqual(['sdtCungCap']);
  });

  it('a filled field the golden does not mention at all is reported, not counted for or against', () => {
    const r = scoreCase(
      golden({ tenCungCap: 'A' }),
      projection(fill('tenCungCap', 'A'), fill('diaChiCungCap', 'Hà Nội')),
    );
    expect(r.unscored).toEqual(['diaChiCungCap']);
    expect(r.correct).toEqual(['tenCungCap']);
  });

  it('reports a separate error rate for the fields the officer must confirm', () => {
    const r = scoreCase(
      golden({ cccdCungCap: '079190012345', tenCungCap: 'A' }),
      projection(
        fill('cccdCungCap', '079190012399', 'AI_FILL_MUST_CONFIRM'),
        fill('tenCungCap', 'A'),
      ),
    );
    expect(r.mustConfirmWrong).toEqual(['cccdCungCap']);
  });
});

describe('summarise', () => {
  it('totals the cases: accuracy over scored fields, and the invented count that must stay zero', () => {
    const a = scoreCase(
      golden({ x: 'a', y: 'b' }),
      projection(fill('x', 'a'), fill('y', 'z')),
    );
    const b = scoreCase(
      golden({ x: 'a', y: null }),
      projection(fill('x', 'a'), fill('y', 'oops')),
    );
    const s = summarise([a, b]);
    expect(s).toMatchObject({
      cases: 2,
      scored: 4,
      correct: 2,
      wrong: 1,
      missing: 0,
      invented: 1,
    });
    expect(s.accuracy).toBeCloseTo(0.5);
    expect(s.inventedRate).toBeCloseTo(0.25);
  });

  it('an empty set scores nothing instead of dividing by zero', () => {
    expect(summarise([])).toMatchObject({
      cases: 0,
      scored: 0,
      accuracy: 0,
      inventedRate: 0,
    });
  });
});
