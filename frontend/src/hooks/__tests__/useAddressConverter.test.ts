import { describe, it, expect } from 'vitest';
import {
  expandAddressAbbreviations,
  inferProvince,
  extractComponents,
} from '../useAddressConverter';

describe('expandAddressAbbreviations', () => {
  it('expands P3 → Phường 3', () => {
    expect(expandAddressAbbreviations('P3')).toBe('Phường 3');
  });

  it('expands P.3 → Phường 3', () => {
    expect(expandAddressAbbreviations('P.3')).toBe('Phường 3');
  });

  it('expands P. 3 → Phường 3 (space after dot)', () => {
    expect(expandAddressAbbreviations('P. 3')).toBe('Phường 3');
  });

  it('expands P03 → Phường 3 (leading zero stripped via parseInt)', () => {
    expect(expandAddressAbbreviations('P03')).toBe('Phường 3');
  });

  it('expands p3 (lowercase) → Phường 3', () => {
    expect(expandAddressAbbreviations('p3')).toBe('Phường 3');
  });

  it('expands Q10 → Quận 10', () => {
    expect(expandAddressAbbreviations('Q10')).toBe('Quận 10');
  });

  it('expands Q.10 → Quận 10', () => {
    expect(expandAddressAbbreviations('Q.10')).toBe('Quận 10');
  });

  it('does NOT expand OP3 (P3 inside another word — Unicode word boundary)', () => {
    expect(expandAddressAbbreviations('OP3')).toBe('OP3');
  });

  it('does NOT expand inside accented Vietnamese letters (ấP3, ờQ10)', () => {
    expect(expandAddressAbbreviations('ấP3')).toBe('ấP3');
    expect(expandAddressAbbreviations('ờQ10')).toBe('ờQ10');
  });

  it('expands address fragments correctly: "337/11B Nguyễn Đình Chiểu, P5, Q3"', () => {
    expect(expandAddressAbbreviations('337/11B Nguyễn Đình Chiểu, P5, Q3'))
      .toBe('337/11B Nguyễn Đình Chiểu, Phường 5, Quận 3');
  });

  it('expands H. <Capital> → Huyện', () => {
    expect(expandAddressAbbreviations('xã Tân Phú H. Bình Chánh'))
      .toBe('xã Tân Phú Huyện Bình Chánh');
  });

  it('does NOT expand "h." inside lowercase prose', () => {
    // "trên đg. h. abc" — h. before lowercase, not expanded
    expect(expandAddressAbbreviations('trên đg. h. abc')).toBe('trên đg. h. abc');
  });

  it('expands P.5 mid-sentence after Vietnamese diacritics: "Đ. Nguyễn Trãi P.5"', () => {
    expect(expandAddressAbbreviations('Đ. Nguyễn Trãi P.5'))
      .toBe('Đ. Nguyễn Trãi Phường 5');
  });
});

describe('inferProvince', () => {
  it('returns HCM for "TP.HCM"', () => {
    expect(inferProvince('25 Lê Lợi, Phường 1, Quận 1, TP.HCM')).toBe('HCM');
  });

  it('returns HCM for "Hồ Chí Minh"', () => {
    expect(inferProvince('123 Nguyễn Huệ, Phường Bến Nghé, Hồ Chí Minh')).toBe('HCM');
  });

  it('returns HCM for "Sài Gòn" (legacy alias)', () => {
    expect(inferProvince('200 Cách Mạng Tháng 8, Sài Gòn')).toBe('HCM');
  });

  it('returns HN for "Hà Nội"', () => {
    expect(inferProvince('Phường 1, Quận Hoàn Kiếm, Hà Nội')).toBe('HN');
  });

  it('returns DN for "Đà Nẵng"', () => {
    expect(inferProvince('12 Lê Lợi, Phường Phú Mỹ, Đà Nẵng')).toBe('DN');
  });

  it('returns HCM as default fallback when no province pattern present', () => {
    expect(inferProvince('337/11B Nguyễn Đình Chiểu, P5, Q3')).toBe('HCM');
  });
});

describe('extractComponents', () => {
  it('extracts ward + district from full-form address', () => {
    const result = extractComponents('25 Lê Lợi, Phường 14, Quận Tân Bình');
    expect(result).not.toBeNull();
    expect(result!.ward).toBe('Phường 14');
    expect(result!.district).toBe('Quận Tân Bình');
  });

  it('extracts from address with abbreviated form post-expansion', () => {
    // After abbreviation expansion, P5 → Phường 5, Q3 → Quận 3
    const expanded = expandAddressAbbreviations('337/11B Nguyễn Đình Chiểu, P5, Q3');
    const result = extractComponents(expanded);
    expect(result).not.toBeNull();
    expect(result!.ward).toBe('Phường 5');
    expect(result!.district).toBe('Quận 3');
  });

  it('handles xã/huyện/thị-trấn variants', () => {
    const result = extractComponents('Xã Long Bình, Huyện Nhà Bè');
    expect(result).not.toBeNull();
    expect(result!.ward).toBe('Xã Long Bình');
    expect(result!.district).toBe('Huyện Nhà Bè');
  });

  it('returns null when no address pattern present', () => {
    expect(extractComponents('Just a street name with no commune')).toBeNull();
  });

  it('returns correct match offsets for replacement', () => {
    const text = '25 Lê Lợi, Phường 14, Quận Tân Bình';
    const result = extractComponents(text);
    expect(result).not.toBeNull();
    expect(text.slice(result!.matchStart, result!.matchEnd))
      .toBe('Phường 14, Quận Tân Bình');
  });
});
