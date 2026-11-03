import { describe, it, expect } from 'vitest';
import { TIM_KIEM_DON_THU } from '../generated';
import { GIA_TRI_CHON_DON_THU } from '../gia-tri-chon-don-thu';
import { HuongXuLyDon, PetitionStatus } from '@/shared/enums/generated';

/**
 * GATE: every SELECT tag of the petition search declaration has a list of values.
 *
 * `OTimKiemThe` builds the suggestions of a select field from this table (`giaTriChon[key] ?? []`). A select field with
 * no entry offers nothing, so it cannot be chosen on any screen - and nothing fails. Three screens (the petition list,
 * Restore, Export reports) used to keep their own copy of the table, which is how a new field was usable on one screen
 * and silently dead on the others.
 */
describe('GIA_TRI_CHON_DON_THU - values of the petition select tags', () => {
  const khoaChon = TIM_KIEM_DON_THU.filter((t) => t.kieu === 'chon').map((t) => t.key);

  it('scans the declaration - a gate that scans nothing is always green', () => {
    expect(khoaChon.length).toBeGreaterThanOrEqual(3);
  });

  it.each(khoaChon)('select tag "%s" has values, each with a code and a label', (khoa) => {
    const ds = (GIA_TRI_CHON_DON_THU as Record<string, readonly { value: string; label: string }[]>)[khoa];
    expect(ds?.length).toBeGreaterThan(0);
    for (const g of ds) {
      expect(g.value).toBeTruthy();
      expect(g.label).toBeTruthy();
    }
  });

  it('the table has no entry for a tag the declaration does not know', () => {
    const khoaKhai = new Set(TIM_KIEM_DON_THU.map((t) => t.key as string));
    expect(Object.keys(GIA_TRI_CHON_DON_THU).filter((k) => !khoaKhai.has(k))).toEqual([]);
  });

  it('status and direction cover every code of their enum', () => {
    expect(GIA_TRI_CHON_DON_THU.trangThai.map((g) => g.value).sort()).toEqual(
      Object.values(PetitionStatus).sort(),
    );
    expect(GIA_TRI_CHON_DON_THU.huongXuLy.map((g) => g.value).sort()).toEqual(
      Object.values(HuongXuLyDon).sort(),
    );
  });

  it('the boolean tag offers exactly the two keys the server accepts (co / khong)', () => {
    expect(GIA_TRI_CHON_DON_THU.laCongNgheCao.map((g) => g.value)).toEqual(['co', 'khong']);
  });
});
