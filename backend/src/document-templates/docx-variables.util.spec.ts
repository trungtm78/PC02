import PizZip from 'pizzip';
import { detectDocxVariables } from './docx-variables.util';

/** docx tối thiểu: 1 file word/document.xml trong zip. */
function makeDocx(bodyText: string): Buffer {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

describe('detectDocxVariables', () => {
  it('trích các biến {ten} duy nhất theo thứ tự xuất hiện', () => {
    const buf = makeDocx('Số {soVuAn} bị can {hoTenBiCan} tội {toiDanh} lại {soVuAn}');
    expect(detectDocxVariables(buf)).toEqual(['soVuAn', 'hoTenBiCan', 'toiDanh']);
  });

  it('bỏ qua {} rỗng và khoảng trắng', () => {
    const buf = makeDocx('a {} b { } c {ok}');
    expect(detectDocxVariables(buf)).toEqual(['ok']);
  });

  it('không có biến → mảng rỗng', () => {
    expect(detectDocxVariables(makeDocx('không có biến'))).toEqual([]);
  });

  it('[review] buffer hỏng / không phải zip → [] (không throw)', () => {
    expect(detectDocxVariables(Buffer.from('không phải docx'))).toEqual([]);
  });

  describe('delimiter động', () => {
    it('delimiter [[ ]] (2 ký tự) trích đúng biến', () => {
      const buf = makeDocx('Số [[soVuAn]] và [[tenVuAn]]');
      expect(detectDocxVariables(buf, { start: '[[', end: ']]' })).toEqual(['soVuAn', 'tenVuAn']);
    });

    it('delimiter {{ }} trích đúng biến', () => {
      const buf = makeDocx('a {{x}} b {{y}}');
      expect(detectDocxVariables(buf, { start: '{{', end: '}}' })).toEqual(['x', 'y']);
    });

    it('delimiter « » với tên tiếng Việt có dấu + khoảng trắng', () => {
      const buf = makeDocx('Kính gửi «Họ tên người gửi», nội dung «Tóm tắt»');
      expect(detectDocxVariables(buf, { start: '«', end: '»' })).toEqual([
        'Họ tên người gửi',
        'Tóm tắt',
      ]);
    });

    it('escape ký tự regex đặc biệt trong delimiter ([[ chứa [)', () => {
      const buf = makeDocx('x [[a]] y [[b]]');
      // không được hiểu [[ là character class → phải trả về đúng a, b
      expect(detectDocxVariables(buf, { start: '[[', end: ']]' })).toEqual(['a', 'b']);
    });

    it('mặc định vẫn là { } (tương thích ngược) khi không truyền delimiter', () => {
      const buf = makeDocx('giữ {soVuAn} nguyên');
      expect(detectDocxVariables(buf)).toEqual(['soVuAn']);
    });
  });

  it('[codex P2] quét cả header/footer (placeholder đầu/chân trang không bị bỏ sót)', () => {
    const zip = new PizZip();
    zip.file('word/document.xml', '<w:document><w:body><w:t>{trongThan}</w:t></w:body></w:document>');
    zip.file('word/header1.xml', '<w:hdr><w:t>{tieuDe}</w:t></w:hdr>');
    zip.file('word/footer1.xml', '<w:ftr><w:t>{chanTrang}</w:t></w:ftr>');
    const names = detectDocxVariables(zip.generate({ type: 'nodebuffer' }));
    expect(names).toEqual(expect.arrayContaining(['trongThan', 'tieuDe', 'chanTrang']));
  });
});
