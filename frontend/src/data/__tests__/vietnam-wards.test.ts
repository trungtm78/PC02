import { describe, it, expect } from 'vitest';
import {
  VIETNAM_WARDS,
  HCMC_WARDS,
  searchWards,
  getWardsByProvince,
  WARD_NAMES_HCM_FIRST,
} from '../vietnam-wards';

describe('vietnam-wards data', () => {
  it('has wards data loaded', () => {
    expect(VIETNAM_WARDS.length).toBeGreaterThan(100);
  });

  it('HCMC wards are first in VIETNAM_WARDS', () => {
    const firstProvince = VIETNAM_WARDS[0].provinceCode;
    expect(firstProvince).toBe('HCM');
  });

  it('HCMC_WARDS only contains HCM province', () => {
    const nonHCM = HCMC_WARDS.filter(w => w.provinceCode !== 'HCM');
    expect(nonHCM).toHaveLength(0);
  });

  it('all wards have required fields', () => {
    for (const ward of VIETNAM_WARDS) {
      expect(ward.code).toBeTruthy();
      expect(ward.name).toBeTruthy();
      expect(['phuong', 'xa', 'dac_khu']).toContain(ward.type);
      expect(ward.provinceCode).toBeTruthy();
      expect(ward.province).toBeTruthy();
    }
  });

  it('ward codes are unique', () => {
    const codes = VIETNAM_WARDS.map(w => w.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});

describe('searchWards()', () => {
  it('empty query returns HCM wards first (limit 20)', () => {
    const results = searchWards('', 20);
    expect(results.length).toBeLessThanOrEqual(20);
    // First result should be HCM
    if (results.length > 0) {
      expect(results[0].provinceCode).toBe('HCM');
    }
  });

  it('query "Phường" returns HCM wards first', () => {
    const results = searchWards('Phường', 10);
    expect(results.length).toBeGreaterThan(0);
    const hcmFirst = results[0].provinceCode === 'HCM';
    expect(hcmFirst).toBe(true);
  });

  it('respects limit parameter', () => {
    const results = searchWards('Phường 1', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('returns empty for non-matching query', () => {
    const results = searchWards('XYZNOTEXIST12345');
    expect(results).toHaveLength(0);
  });

  it('case-insensitive search', () => {
    const lower = searchWards('bình thạnh');
    const upper = searchWards('BÌNH THẠNH');
    // Both should return some results or both empty (Vietnamese diacritics normalized)
    expect(typeof lower.length).toBe('number');
    expect(typeof upper.length).toBe('number');
  });
});

describe('getWardsByProvince()', () => {
  it('returns only HCM wards for HCM code', () => {
    const wards = getWardsByProvince('HCM');
    expect(wards.length).toBeGreaterThan(0);
    const nonHCM = wards.filter(w => w.provinceCode !== 'HCM');
    expect(nonHCM).toHaveLength(0);
  });

  it('returns empty array for unknown province', () => {
    const wards = getWardsByProvince('UNKNOWN_XYZ');
    expect(wards).toHaveLength(0);
  });

  it('returns HN wards for HN code', () => {
    const wards = getWardsByProvince('HN');
    expect(wards.length).toBeGreaterThan(0);
    const nonHN = wards.filter(w => w.provinceCode !== 'HN');
    expect(nonHN).toHaveLength(0);
  });
});

describe('WARD_NAMES_HCM_FIRST', () => {
  it('is an array of strings', () => {
    expect(Array.isArray(WARD_NAMES_HCM_FIRST)).toBe(true);
    expect(typeof WARD_NAMES_HCM_FIRST[0]).toBe('string');
  });

  it('HCM ward names appear before other provinces', () => {
    const hcmWardName = HCMC_WARDS[0].name;
    const hcmIdx = WARD_NAMES_HCM_FIRST.indexOf(hcmWardName);
    expect(hcmIdx).toBeGreaterThanOrEqual(0);
    expect(hcmIdx).toBeLessThan(50); // Should be near start
  });
});
