import { describe, expect, it } from 'vitest';
import {
  CHEP_NOI_DUNG,
  DAT_LAI_MOC_HO_SO,
  chepSangDonMoi,
} from '../PetitionFormPage/chepSangDonMoi';
import { INITIAL_PETITION_FORM, type PetitionFormData } from '../PetitionFormPage/types';

function sourceWithDistinctValues(): PetitionFormData {
  const source = structuredClone(INITIAL_PETITION_FORM);
  for (const key of Object.keys(source) as (keyof PetitionFormData)[]) {
    const value = source[key];
    if (key === 'legacyExtra') continue;
    Object.assign(source, {
      [key]: typeof value === 'boolean' ? !value : `SOURCE-${String(key)}`,
    });
  }
  source.legacyExtra = {
    nhanXet: 'Nhận xét hệ cũ',
    ngayVietDon: '2024-03-01',
    ketQuaXuLy: '',
  };
  return source;
}

describe('Tạo đơn mới từ đơn này — hợp đồng trường', () => {
  it('mọi trường form thuộc đúng một nhóm sao chép hoặc đặt lại', () => {
    const copied = new Set<string>(CHEP_NOI_DUNG);
    const reset = new Set<string>(DAT_LAI_MOC_HO_SO);
    const keys = Object.keys(INITIAL_PETITION_FORM);

    expect(keys.filter((key) => !copied.has(key) && !reset.has(key))).toEqual([]);
    expect(keys.filter((key) => copied.has(key) && reset.has(key))).toEqual([]);
    expect([...copied, ...reset].filter((key) => !(key in INITIAL_PETITION_FORM))).toEqual([]);
  });

  it('sao chép nguyên mọi giá trị người dùng nhập, kể cả chuỗi rỗng và 10 tab hệ cũ', () => {
    const source = sourceWithDistinctValues();
    const cloned = chepSangDonMoi(source);

    for (const key of CHEP_NOI_DUNG) expect(cloned[key]).toEqual(source[key]);
    expect(cloned.legacyExtra).toEqual(source.legacyExtra);
    expect(cloned.legacyExtra).not.toBe(source.legacyExtra);
    expect(cloned.ngayVietDonEdtf).toBe(source.ngayVietDonEdtf);
    expect(cloned.nhanThay).toBe(source.nhanThay);
    expect(cloned.ketQuaXuLyKhac).toBe(source.ketQuaXuLyKhac);
  });

  it('chỉ đặt lại định danh, phân công và xác nhận trùng', () => {
    const source = sourceWithDistinctValues();
    const cloned = chepSangDonMoi(source);

    for (const key of DAT_LAI_MOC_HO_SO) {
      expect(cloned[key]).toEqual(INITIAL_PETITION_FORM[key]);
    }
  });

  it('không sửa hồ sơ nguồn', () => {
    const source = sourceWithDistinctValues();
    const snapshot = structuredClone(source);
    chepSangDonMoi(source);
    expect(source).toEqual(snapshot);
  });
});
