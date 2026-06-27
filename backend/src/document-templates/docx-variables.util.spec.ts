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
});
