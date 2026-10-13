import { aggregateValues, type BlankPolicy } from './aggregate';

// DECISIONS_20261009.md AC-025 and FRD §4.5 both require COUNT=2
// for [10, 0, null]. ZERO changes arithmetic, not whether a value was entered.
describe('COUNT acceptance: count entered numbers, including explicit zero', () => {
  it.each<BlankPolicy>(['ZERO', 'IGNORE'])(
    '%s excludes blank contributions',
    (policy) => {
      const contributions = ['10', '0', null].map((value, i) => ({
        sourceId: `team-${i}`,
        value,
      }));
      const result = aggregateValues('COUNT', policy, contributions);
      expect(result.value).toBe('2');
      expect(result.countTotal).toBe(3);
      expect(result.countNonBlank).toBe(2);
      expect(result.contributors).toEqual(contributions);
    },
  );

  it('ZERO does not invent entered values for an all-blank set', () => {
    expect(
      aggregateValues('COUNT', 'ZERO', [{ sourceId: 'blank', value: null }])
        .value,
    ).toBe('0');
  });
});
