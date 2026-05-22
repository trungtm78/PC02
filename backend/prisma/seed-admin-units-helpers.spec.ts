import { findOrphanIds } from './seed-admin-units-helpers';

describe('findOrphanIds — generic supersede orphan detection', () => {
  it('returns IDs of rows whose code is NOT in the new dataset', () => {
    const dbRows = [
      { id: 'a', code: 'AAA' },
      { id: 'b', code: 'BBB' },
      { id: 'c', code: 'CCC' },
    ];
    const newCodes = new Set(['AAA', 'CCC']); // BBB no longer in dataset
    expect(findOrphanIds(dbRows, newCodes)).toEqual(['b']);
  });

  it('returns empty when all DB rows match dataset', () => {
    const dbRows = [
      { id: '1', code: 'X' },
      { id: '2', code: 'Y' },
    ];
    expect(findOrphanIds(dbRows, new Set(['X', 'Y']))).toEqual([]);
  });

  it('returns all DB IDs when dataset is empty', () => {
    const dbRows = [
      { id: '1', code: 'X' },
      { id: '2', code: 'Y' },
    ];
    expect(findOrphanIds(dbRows, new Set())).toEqual(['1', '2']);
  });

  it('returns empty when DB is empty', () => {
    expect(findOrphanIds([], new Set(['X', 'Y']))).toEqual([]);
  });
});
