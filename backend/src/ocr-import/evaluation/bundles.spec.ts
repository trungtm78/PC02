import { groupBundles, parseArgs } from './bundles';

describe('groupBundles', () => {
  it('puts scans that were taken together (file names stamped within two seconds) in one bundle', () => {
    const names = [
      '1793677102678_x.jpg',
      '1793677102696_x.jpg',
      '1793677129485_x.jpg',
      '1793677129521_x.jpg',
      '1793677129544_x.jpg',
      '1793677300828_x.jpg',
    ];
    expect(groupBundles(names).map((b) => b.length)).toEqual([2, 3, 1]);
  });

  it('does not depend on the order the names were listed in', () => {
    const names = ['1793677129485_b.jpg', '1793677102678_a.jpg'];
    expect(groupBundles(names).map((b) => b[0])).toEqual([
      '1793677102678_a.jpg',
      '1793677129485_b.jpg',
    ]);
  });

  it('a name without a timestamp is a bundle of its own', () => {
    expect(
      groupBundles(['scan-a.jpg', 'scan-b.jpg']).map((b) => b.length),
    ).toEqual([1, 1]);
  });

  it('nothing in, nothing out', () => {
    expect(groupBundles([])).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('reads flags with values and switches', () => {
    expect(
      parseArgs([
        '--dir',
        'a',
        '--entity',
        'case',
        '--init-golden',
        '--bundles',
        '0,2',
      ]),
    ).toEqual({
      dir: 'a',
      entity: 'case',
      'init-golden': true,
      bundles: '0,2',
    });
  });

  it('refuses an argument that is not a flag, rather than guessing what was meant', () => {
    expect(() => parseArgs(['oops'])).toThrow('oops');
  });
});
