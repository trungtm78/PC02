import { buildCrimeCatalog } from './crime-catalog';
import { RAW_BLHS_2015_CRIMES } from './data/blhs2015-crimes';

describe('buildCrimeCatalog (master tội danh BLHS 2015)', () => {
  const catalog = buildCrimeCatalog();

  it('sinh đúng 1 entry cho mỗi tội danh thô (316)', () => {
    expect(catalog).toHaveLength(RAW_BLHS_2015_CRIMES.length);
  });

  it('code = D{articleNo}', () => {
    expect(catalog.find((c) => c.articleNo === 123)?.code).toBe('D123');
    expect(catalog.find((c) => c.articleNo === 108)?.code).toBe('D108');
  });

  it('giữ legacyValue (số) để map khi di trú', () => {
    const c = catalog.find((c) => c.articleNo === 108);
    expect(typeof c?.legacyValue).toBe('number');
  });

  it('gán đúng chương theo dải số Điều', () => {
    expect(catalog.find((c) => c.articleNo === 108)?.chapter).toBe('XIII'); // an ninh QG
    expect(catalog.find((c) => c.articleNo === 123)?.chapter).toBe('XIV'); // giết người
    expect(catalog.find((c) => c.articleNo === 157)?.chapter).toBe('XV'); // tự do con người
    expect(catalog.find((c) => c.articleNo === 173)?.chapter).toBe('XVI'); // trộm cắp
    expect(catalog.find((c) => c.articleNo === 251)?.chapter).toBe('XX'); // ma túy
    expect(catalog.find((c) => c.articleNo === 260)?.chapter).toBe('XXI'); // trật tự công cộng
    expect(catalog.find((c) => c.articleNo === 425)?.chapter).toBe('XXVI'); // lính đánh thuê
  });

  it('đánh dấu pc02Relevant=true cho chương TTXH (XIV,XV,XVI,XVII,XXI)', () => {
    expect(catalog.find((c) => c.articleNo === 123)?.pc02Relevant).toBe(true); // XIV
    expect(catalog.find((c) => c.articleNo === 157)?.pc02Relevant).toBe(true); // XV
    expect(catalog.find((c) => c.articleNo === 173)?.pc02Relevant).toBe(true); // XVI
    expect(catalog.find((c) => c.articleNo === 181)?.pc02Relevant).toBe(true); // XVII
    expect(catalog.find((c) => c.articleNo === 260)?.pc02Relevant).toBe(true); // XXI
  });

  it('đánh dấu pc02Relevant=false cho chương ngoài phạm vi PC02', () => {
    expect(catalog.find((c) => c.articleNo === 108)?.pc02Relevant).toBe(false); // XIII an ninh QG
    expect(catalog.find((c) => c.articleNo === 200)?.pc02Relevant).toBe(false); // XVIII kinh tế
    expect(catalog.find((c) => c.articleNo === 251)?.pc02Relevant).toBe(false); // XX ma túy
    expect(catalog.find((c) => c.articleNo === 235)?.pc02Relevant).toBe(false); // XIX môi trường
  });

  it('mọi entry có name không rỗng và order = articleNo', () => {
    for (const c of catalog) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.order).toBe(c.articleNo);
      expect(c.isActive).toBe(true);
    }
  });

  it('code là duy nhất', () => {
    const codes = catalog.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
