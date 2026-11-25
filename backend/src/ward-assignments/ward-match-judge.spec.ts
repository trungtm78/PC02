import { judge } from './ward-matching.service';

const me = { fullNameNorm: 'nguyen van an', birthYear: 1990, idNumberNorm: '079090000001', address: 'Hẻm 12 Vườn Lài' };

describe('judging one pair of subjects', () => {
  it('the same identity number is certain, whatever else differs, and says what is the same', () => {
    expect(judge(me, { nameNorm: 'nguyen van binh', birthYear: 1985, idNumberNorm: '079090000001' })).toEqual({ level: 'CERTAIN', reasons: ['ID_NUMBER'] });
    expect(judge(me, { nameNorm: 'nguyen van an', birthYear: 1990, idNumberNorm: '079090000001', address: 'hem 12 vuon lai' })).toEqual({
      level: 'CERTAIN',
      reasons: ['ID_NUMBER', 'NAME', 'BIRTH_YEAR', 'ADDRESS'],
    });
  });

  it('the same name and birth year is possible', () => {
    expect(judge(me, { nameNorm: 'nguyen van an', birthYear: 1990, idNumberNorm: null })).toEqual({ level: 'POSSIBLE', reasons: ['NAME', 'BIRTH_YEAR'] });
  });

  it('the same name with a birth year missing on either side, or one year apart, is near', () => {
    expect(judge(me, { nameNorm: 'nguyen van an', birthYear: null, idNumberNorm: null })).toEqual({ level: 'NEAR', reasons: ['NAME'] });
    expect(judge({ ...me, birthYear: null }, { nameNorm: 'nguyen van an', birthYear: 1990, idNumberNorm: null })).toEqual({ level: 'NEAR', reasons: ['NAME'] });
    expect(judge(me, { nameNorm: 'nguyen van an', birthYear: 1991, idNumberNorm: null })).toEqual({ level: 'NEAR', reasons: ['NAME', 'BIRTH_YEAR_NEAR'] });
  });

  it('is not a match: another name, the same name two years apart, two different identity numbers alone', () => {
    expect(judge(me, { nameNorm: 'tran van an', birthYear: 1990, idNumberNorm: null })).toBeNull();
    expect(judge(me, { nameNorm: 'nguyen van an', birthYear: 1992, idNumberNorm: null })).toBeNull();
    expect(judge({ ...me, fullNameNorm: '' }, { nameNorm: '', birthYear: 1990, idNumberNorm: '079' })).toBeNull();
  });
});
