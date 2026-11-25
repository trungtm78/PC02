import { resolveField, yeuCauDanhSo } from '../document-templates/field-catalog';
import { shortWardName, splitWardList, teamKey, wardExactKey, wardKey } from './team-ward-charges.import';

const CLOSING = 'Trong quá trình điều tra, trường hợp gặp khó khăn, vướng mắc, cần kịp thời báo cáo về Phòng PC02';

describe('the closing item of the request slip', () => {
  it('is item N + 1 and names the team in charge, joined like the requirements', () => {
    expect(yeuCauDanhSo(['Hỏi cung', 'Giám định'], { teamName: 'Tổ công tác Số 4' })).toBe(
      `1. Hỏi cung\n2. Giám định\n3. ${CLOSING} (qua Tổ công tác Số 4 hoặc Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`,
    );
  });

  it('is item 1 when there is no requirement', () => {
    expect(yeuCauDanhSo([], { teamName: 'Tổ công tác Số 4' })).toBe(`1. ${CLOSING} (qua Tổ công tác Số 4 hoặc Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`);
  });

  it('says "(qua Đội 1)" when nobody is in charge of the ward', () => {
    expect(yeuCauDanhSo(['Hỏi cung'], { teamName: null })).toBe(`1. Hỏi cung\n2. ${CLOSING} (qua Đội 1) để được hướng dẫn, phối hợp, hỗ trợ.`);
  });

  it('is not printed by a record without `wardCharge` (a slip issued before the item existed)', () => {
    expect(yeuCauDanhSo(['Hỏi cung', 'Giám định'])).toBe('1. Hỏi cung\n2. Giám định');
    expect(resolveField('HO_SO_PHAN_CONG', 'yeuCau', { decision: { requirements: ['A'] }, wardCharge: null })).toBe('1. A');
    expect(resolveField('HO_SO_PHAN_CONG', 'yeuCau', { decision: { requirements: ['A'] }, wardCharge: { teamName: 'Cơ sở 1' } })).toContain(
      '2. Trong quá trình điều tra',
    );
  });
});

describe('matching names of the import file', () => {
  it('a team name ignores spaces, case and diacritics', () => {
    expect(teamKey('Tổ công tác Số 4')).toBe(teamKey('Tổ công tác số 4'));
    expect(teamKey('Tổ công tác Số 4')).toBe(teamKey(' to  cong tac SO 4 '));
    expect(teamKey('Tổ công tác Số 4')).not.toBe(teamKey('Tổ công tác Số 41'));
  });

  it('a ward name ignores punctuation at its edges and the Phường/Xã/Đặc khu prefix', () => {
    expect(wardKey('Khánh Hội ')).toBe(wardKey('Phường Khánh Hội'));
    expect(wardKey(': Vĩnh Tân')).toBe(wardKey('Phường Vĩnh Tân'));
    expect(wardKey('đặc khu Côn Đảo')).toBe(wardKey('Đặc khu Côn Đảo'));
    expect(wardKey('Côn Đảo')).toBe(wardKey('Đặc khu Côn Đảo'));
    expect(wardKey('Trừ Văn Thố.')).toBe(wardKey('Xã Trừ Văn Thố'));
    expect(wardKey('Vườn Lài')).not.toBe(wardKey('Phường Vườn Lài Mới'));
  });

  it('the exact key keeps the accents that tell "Thạnh An" from "Thanh An"', () => {
    expect(wardExactKey('Thạnh An.')).toBe(wardExactKey('Xã Thạnh An'));
    expect(wardExactKey('Thạnh An')).not.toBe(wardExactKey('Xã Thanh An'));
    expect(wardExactKey('đặc khu Côn Đảo')).toBe(wardExactKey('Đặc khu Côn Đảo'));
  });

  it('the list of column C splits on commas and drops the dirt', () => {
    expect(splitWardList('Sài Gòn, Tân Định, Khánh Hội , Vĩnh Hội.')).toEqual(['Sài Gòn', 'Tân Định', 'Khánh Hội', 'Vĩnh Hội']);
    expect(splitWardList('An Phú, : Vĩnh Tân, Bình Cơ.')).toEqual(['An Phú', 'Vĩnh Tân', 'Bình Cơ']);
    expect(splitWardList('')).toEqual([]);
  });

  it('the template writes a ward as the file does', () => {
    expect(shortWardName('Phường Vườn Lài')).toBe('Vườn Lài');
    expect(shortWardName('Xã Trừ Văn Thố')).toBe('Trừ Văn Thố');
    expect(shortWardName('Đặc khu Côn Đảo')).toBe('Côn Đảo');
  });
});
