import {
  resolveDuplicateKey,
  scoreDuplicateGroup,
} from './petitions.service';

/**
 * The duplicate check grouped on ONE column with an exact string match, and
 * everything in a group was reported as a duplicate. "Nguyễn Văn A" is not a
 * rare name in Vietnam, so two unrelated citizens filing separate petitions
 * were presented as the same person filing twice — on a legal record that is
 * an accusation, not a hint.
 *
 * The score exists so the screen can say "khớp 3/4 tiêu chí" instead of
 * inventing a similarity percentage.
 */
describe('scoreDuplicateGroup', () => {
  it('scores a genuine duplicate as matching on everything comparable', () => {
    const same = {
      senderName: 'Nguyễn Văn A',
      senderPhone: '0901234567',
      senderAddress: 'Số 1 Nguyễn Huệ',
      suspectedPerson: 'Trần Văn B',
    };

    expect(scoreDuplicateGroup([same, { ...same }])).toEqual({
      matched: 4,
      compared: 4,
    });
  });

  it('separates two people who merely share a name', () => {
    // The exact case that made this necessary.
    const score = scoreDuplicateGroup([
      {
        senderName: 'Nguyễn Văn A',
        senderPhone: '0901111111',
        senderAddress: 'Quận 1',
        suspectedPerson: 'X',
      },
      {
        senderName: 'Nguyễn Văn A',
        senderPhone: '0902222222',
        senderAddress: 'Quận 7',
        suspectedPerson: 'Y',
      },
    ]);

    expect(score).toEqual({ matched: 1, compared: 4 });
  });

  it('ignores a field nobody filled in rather than counting it as a mismatch', () => {
    // A blank column is not evidence either way. Counting it against the
    // group would make sparse legacy records look less alike than they are.
    const score = scoreDuplicateGroup([
      { senderName: 'A', senderPhone: '090', senderAddress: '', suspectedPerson: '' },
      { senderName: 'A', senderPhone: '090', senderAddress: '', suspectedPerson: '' },
    ]);

    expect(score).toEqual({ matched: 2, compared: 2 });
  });

  it('ignores a field only some of the group filled in', () => {
    const score = scoreDuplicateGroup([
      { senderName: 'A', senderPhone: '090' },
      { senderName: 'A', senderPhone: '' },
    ]);

    expect(score).toEqual({ matched: 1, compared: 1 });
  });

  it('ignores case and surrounding spaces', () => {
    const score = scoreDuplicateGroup([
      { senderName: ' Nguyễn Văn A ' },
      { senderName: 'nguyễn văn a' },
    ]);

    expect(score).toEqual({ matched: 1, compared: 1 });
  });

  it('scores nothing for a group of one', () => {
    expect(scoreDuplicateGroup([{ senderName: 'A' }])).toEqual({
      matched: 0,
      compared: 0,
    });
  });

  it('handles null the same as blank', () => {
    const score = scoreDuplicateGroup([
      { senderName: 'A', senderPhone: null },
      { senderName: 'A', senderPhone: null },
    ]);

    expect(score).toEqual({ matched: 1, compared: 1 });
  });
});

describe('resolveDuplicateKey', () => {
  it.each([
    ['senderName', 'senderName'],
    ['Họ tên', 'senderName'],
    ['senderPhone', 'senderPhone'],
    ['Số điện thoại', 'senderPhone'],
    ['Địa chỉ', 'senderAddress'],
    ['Bị đơn trùng', 'suspectedPerson'],
  ])('maps %s to %s', (input, expected) => {
    expect(resolveDuplicateKey(input)).toBe(expected);
  });

  it('falls back to senderName for anything unrecognised', () => {
    // Never an arbitrary column: the key goes straight into a groupBy.
    expect(resolveDuplicateKey('rác')).toBe('senderName');
    expect(resolveDuplicateKey(undefined)).toBe('senderName');
  });
});
