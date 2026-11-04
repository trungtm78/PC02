import { describe, expect, it } from 'vitest';
import { PETITION_OCR_ACCESS } from '../petitionOcrAccess';
import { INITIAL_PETITION_FORM } from '../types';

/*
  Found by clicking through the screen with a real scan: the box the officer sees as "Ngày viết đơn" shows
  `ngayVietDonEdtf` / `ngayVietDonChu`, while the scan fill wrote only the real date column `petitionDate`. The box
  stayed empty under a "Đã xác nhận" badge, and the date could be lost on save.
*/
describe('PETITION_OCR_ACCESS for the letter date', () => {
  it('writes the date where the visible box reads it, and keeps the real date column', () => {
    const next = PETITION_OCR_ACCESS.write(INITIAL_PETITION_FORM, 'petitionDate', '2026-10-29');
    expect(next.petitionDate).toBe('2026-10-29');
    expect(next.ngayVietDonEdtf).toBe('2026-10-29');
    expect(next.ngayVietDonChu).toBe('');
  });

  it('undoing the fill (writing the empty value back) empties all three', () => {
    const filled = PETITION_OCR_ACCESS.write(INITIAL_PETITION_FORM, 'petitionDate', '2026-10-29');
    const undone = PETITION_OCR_ACCESS.write(filled, 'petitionDate', '');
    expect([undone.petitionDate, undone.ngayVietDonEdtf, undone.ngayVietDonChu]).toEqual(['', '', '']);
  });

  it('counts a half-typed date as the officer\'s own, so the fill does not overwrite it', () => {
    const typed = { ...INITIAL_PETITION_FORM, ngayVietDonEdtf: '2026-10', ngayVietDonChu: '' };
    expect(PETITION_OCR_ACCESS.read(typed, 'petitionDate')).toBe('2026-10');
    const verbatim = { ...INITIAL_PETITION_FORM, ngayVietDonChu: '../../2026' };
    expect(PETITION_OCR_ACCESS.read(verbatim, 'petitionDate')).toBe('../../2026');
  });

  it('leaves every other field to the layout spec', () => {
    const next = PETITION_OCR_ACCESS.write(INITIAL_PETITION_FORM, 'senderName', 'Nguyễn Văn A');
    expect(next.senderName).toBe('Nguyễn Văn A');
    expect(next.ngayVietDonEdtf).toBe(INITIAL_PETITION_FORM.ngayVietDonEdtf);
    expect(PETITION_OCR_ACCESS.read(next, 'senderName')).toBe('Nguyễn Văn A');
  });
});
