import { resolveEffectiveLocked } from './locked';

/**
 * Effective-lock resolution (spec §10 R3): exceljs only reflects the
 * EXPLICIT protection a cell/row/column's own xf declares — it does not
 * walk Excel's own style-inheritance chain. A cell with no explicit style
 * returns `undefined` from exceljs, so this module does cell → row style →
 * column style → Excel's true default (locked=true) ourselves. Verified
 * empirically against the real HSLN fixture: cells without their own `s`
 * attribute report `undefined`, and HSLN's `<col style="30">` does not
 * declare protection, so unlocked-ness there is always cell-level.
 */
describe('resolveEffectiveLocked', () => {
  it('uses the cell-level value when the cell itself declares protection', () => {
    expect(resolveEffectiveLocked(false, true, true)).toBe(false);
    expect(resolveEffectiveLocked(true, false, false)).toBe(true);
  });

  it('falls back to the row when the cell has no explicit protection', () => {
    expect(resolveEffectiveLocked(undefined, false, true)).toBe(false);
    expect(resolveEffectiveLocked(undefined, true, false)).toBe(true);
  });

  it('falls back to the column when neither cell nor row declare protection', () => {
    expect(resolveEffectiveLocked(undefined, undefined, false)).toBe(false);
    expect(resolveEffectiveLocked(undefined, undefined, true)).toBe(true);
  });

  it('defaults to locked=true (Excel default) when nothing declares protection', () => {
    expect(resolveEffectiveLocked(undefined, undefined, undefined)).toBe(true);
  });
});
