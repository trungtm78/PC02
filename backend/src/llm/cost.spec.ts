import {
  budgetLevel,
  dayStartVietnam,
  estimateCostMicroUsd,
  monthStartVietnam,
} from './cost';

describe('estimateCostMicroUsd', () => {
  const price = {
    inputMicroUsdPerMTok: 1_000_000,
    outputMicroUsdPerMTok: 5_000_000,
  };

  it('prices input and output tokens separately, in micro-USD', () => {
    expect(
      estimateCostMicroUsd({ inputTokens: 1000, outputTokens: 200 }, price),
    ).toBe(1000 + 1000);
  });

  it('rounds to a whole micro-USD', () => {
    expect(
      estimateCostMicroUsd({ inputTokens: 1, outputTokens: 1 }, price),
    ).toBe(6);
  });

  it('is unknown (null) when no price is set, rather than zero', () => {
    expect(
      estimateCostMicroUsd({ inputTokens: 5, outputTokens: 5 }, null),
    ).toBeNull();
    expect(
      estimateCostMicroUsd(
        { inputTokens: 5, outputTokens: 5 },
        { inputMicroUsdPerMTok: 1, outputMicroUsdPerMTok: null },
      ),
    ).toBeNull();
  });
});

describe('budgetLevel', () => {
  it('a cap of 0 means unlimited', () => {
    expect(budgetLevel(10 ** 9, 0)).toBe('OK');
  });
  it('warns from 80 percent and stops at 100 percent', () => {
    expect(budgetLevel(799, 1000)).toBe('OK');
    expect(budgetLevel(800, 1000)).toBe('WARN');
    expect(budgetLevel(999, 1000)).toBe('WARN');
    expect(budgetLevel(1000, 1000)).toBe('EXHAUSTED');
    expect(budgetLevel(5000, 1000)).toBe('EXHAUSTED');
  });
});

describe('Vietnam day and month boundaries (UTC+7, no daylight saving)', () => {
  it('a UTC evening already belongs to the next Vietnam day', () => {
    const now = new Date('2026-11-03T18:00:00Z'); // 01:00 on 4 Nov in Vietnam
    expect(dayStartVietnam(now).toISOString()).toBe('2026-11-03T17:00:00.000Z');
  });
  it('a UTC morning belongs to the same Vietnam day', () => {
    const now = new Date('2026-11-03T02:00:00Z'); // 09:00 on 3 Nov
    expect(dayStartVietnam(now).toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });
  it('the month rolls over at midnight Vietnam time, not UTC', () => {
    const now = new Date('2026-10-31T18:00:00Z'); // 01:00 on 1 Nov in Vietnam
    expect(monthStartVietnam(now).toISOString()).toBe(
      '2026-10-31T17:00:00.000Z',
    );
    const earlier = new Date('2026-10-31T10:00:00Z'); // 17:00 on 31 Oct
    expect(monthStartVietnam(earlier).toISOString()).toBe(
      '2026-09-30T17:00:00.000Z',
    );
  });
});
