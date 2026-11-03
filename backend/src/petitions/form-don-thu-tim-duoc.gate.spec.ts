import { KHAI_TIM_KIEM_DON_THU } from '../common/tim-kiem/khai/don-thu.khai';
import type { KhaiThucThe } from '../common/tim-kiem/sinh/sinh-tim-kiem';
import { COT_XUAT_DAY_DU_LOAI_TRU } from './cot-xuat-day-du.loai-tru';
import {
  TRUONG_FORM_DON_THU,
  type TruongFormDonThu,
} from './khai-truong-form-don-thu.generated';

/**
 * GATE: every field on the Petition form must be searchable from the list, unless it was MEASURED empty.
 *
 * Why: the "search in every column" box only knew 12 of the form's 130 fields. A field nobody can search is
 * invisible to the officer who typed it, and nothing failed - the form saved, the list rendered, the box simply
 * never matched. The empty fields are excluded by `COT_XUAT_DAY_DU_LOAI_TRU` (measured on production and re-measured
 * on every deploy), so this gate REUSES that list instead of keeping a second one: the day a field stops being empty
 * and leaves that list, this gate goes red and demands a search declaration for it.
 */

/** A form field is searchable when a declared tag reads the same storage: column, relation id, or JSON key. */
function coveredByDeclaration(
  khai: KhaiThucThe,
  field: TruongFormDonThu,
): boolean {
  return khai.truong.some((t) => {
    if (field.cot !== null) {
      if (t.nguonJson === undefined && t.cot === field.cot) return true;
      // A relation tag reads the `<relation>Id` column (e.g. crimeChinh -> crimeChinhId).
      return t.kieu === 'quan-he' && `${t.quanHe}Id` === field.cot;
    }
    return t.nguonJson?.khoa === field.khoaLuu;
  });
}

function missingSearch(
  khai: KhaiThucThe,
  form: readonly TruongFormDonThu[],
): string[] {
  const measuredEmpty = new Set(COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu));
  return form
    .filter((f) => !measuredEmpty.has(f.khoaLuu))
    .filter((f) => !coveredByDeclaration(khai, f))
    .map((f) => `${f.khoaLuu} (${f.caption})`);
}

describe('Petition form fields are searchable', () => {
  it('scans the whole form - a gate that scans nothing is always green', () => {
    expect(TRUONG_FORM_DON_THU.length).toBeGreaterThanOrEqual(130);
    expect(COT_XUAT_DAY_DU_LOAI_TRU.length).toBeGreaterThanOrEqual(88);
  });

  it('every non-empty form field has a search declaration', () => {
    expect(missingSearch(KHAI_TIM_KIEM_DON_THU, TRUONG_FORM_DON_THU)).toEqual(
      [],
    );
  });

  it('a field measured empty is excluded, and a measurement that goes stale is not tolerated', () => {
    const empty = COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu);
    // Every excluded key must still exist on the form: a stale entry would hide a renamed field for good.
    const onForm = new Set(TRUONG_FORM_DON_THU.map((f) => f.khoaLuu));
    expect(empty.filter((k) => !onForm.has(k))).toEqual([]);
  });

  it('seeded fault: removing a declaration turns the gate red for exactly that field', () => {
    for (const key of ['soPhieuChuyen', 'nhanXet', 'ngayKhoiTo']) {
      const without: KhaiThucThe = {
        ...KHAI_TIM_KIEM_DON_THU,
        truong: KHAI_TIM_KIEM_DON_THU.truong.filter((t) => t.key !== key),
      };
      const missing = missingSearch(without, TRUONG_FORM_DON_THU);
      expect(missing).toHaveLength(1);
    }
  });

  it('seeded fault: the Nhận xét tag must read nhanThay, not the cases column nhanXet', () => {
    const wrong: KhaiThucThe = {
      ...KHAI_TIM_KIEM_DON_THU,
      truong: KHAI_TIM_KIEM_DON_THU.truong.map((t) =>
        t.key === 'nhanXet' ? { ...t, cot: 'nhanXet' } : t,
      ),
    };
    expect(missingSearch(wrong, TRUONG_FORM_DON_THU)).toEqual([
      expect.stringContaining('nhanThay'),
    ]);
  });
});
