import {
  parseVietnameseDigits,
  parseVietnameseWords,
} from './vietnamese-number';

describe('parseVietnameseDigits', () => {
  it('reads "." and "," as thousands separators when they group three digits', () => {
    expect(parseVietnameseDigits('495.253.647')).toBe(495253647);
    expect(parseVietnameseDigits('495,253,647')).toBe(495253647);
    expect(parseVietnameseDigits('1.500.000')).toBe(1500000);
  });

  it('reads plain digits and strips currency words and spaces', () => {
    expect(parseVietnameseDigits('1500000')).toBe(1500000);
    expect(parseVietnameseDigits('495.253.647 đồng')).toBe(495253647);
    expect(parseVietnameseDigits(' 20 000 000 ')).toBe(20000000);
    expect(parseVietnameseDigits('6,896,832đ')).toBe(6896832);
  });

  it('refuses a figure with a decimal part: an amount in dong is a whole number', () => {
    expect(parseVietnameseDigits('1,5')).toBeNull();
    expect(parseVietnameseDigits('1.5')).toBeNull();
  });

  it('returns null for text that is not a number', () => {
    expect(parseVietnameseDigits('')).toBeNull();
    expect(parseVietnameseDigits('abc')).toBeNull();
    expect(parseVietnameseDigits('12.34.5')).toBeNull();
  });
});

describe('parseVietnameseWords', () => {
  const cases: Array<[string, number]> = [
    [
      'Bốn trăm chín mươi lăm triệu hai trăm năm mươi ba nghìn sáu trăm bốn mươi bảy đồng',
      495253647,
    ],
    ['Hai mươi triệu đồng', 20000000],
    ['Một triệu năm trăm nghìn đồng', 1500000],
    [
      'Bốn trăm bảy mươi tám triệu bốn trăm tám mươi mốt nghìn bốn trăm ba mươi hai đồng',
      478481432,
    ],
    ['Mười lăm triệu', 15000000],
    ['Hai trăm linh năm nghìn', 205000],
    ['Hai trăm lẻ năm', 205],
    ['Một tỷ hai trăm triệu', 1200000000],
    [
      'Bảy mươi mốt triệu bảy trăm bảy mươi hai nghìn hai trăm mười lăm đồng',
      71772215,
    ],
    [
      'Sáu triệu tám trăm chín mươi sáu nghìn tám trăm ba mươi hai đồng',
      6896832,
    ],
  ];
  it.each(cases)('%s', (words, value) => {
    expect(parseVietnameseWords(words)).toBe(value);
  });

  it('ignores case, punctuation, parentheses and a leading "Bằng chữ:"', () => {
    expect(
      parseVietnameseWords(
        '(Bằng chữ: Bốn trăm chín mươi lăm triệu hai trăm năm mươi ba nghìn sáu trăm bốn mươi bảy đồng)',
      ),
    ).toBe(495253647);
  });

  it('accepts "ngàn" for "nghìn" and "tư" for four', () => {
    expect(parseVietnameseWords('hai mươi tư ngàn')).toBe(24000);
  });

  it('returns null when a word is not a number word, rather than guessing', () => {
    expect(parseVietnameseWords('hai trăm xyz nghìn')).toBeNull();
    expect(parseVietnameseWords('')).toBeNull();
    expect(parseVietnameseWords('đồng')).toBeNull();
  });
});
