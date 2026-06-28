import PizZip from 'pizzip';
import { normalizeDocxTags } from './docx-normalize.util';
import { detectDocxVariables } from './docx-variables.util';

/** Tạo .docx với body XML thô (mô phỏng Word tách run / chèn proofErr). */
function makeRawDocx(bodyXml: string): Buffer {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${bodyXml}</w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

function bodyXmlOf(buf: Buffer): string {
  return new PizZip(buf).file('word/document.xml')!.asText();
}

describe('normalizeDocxTags', () => {
  it('strip <w:proofErr/> (Word chèn quanh từ sai chính tả tiếng Việt)', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>Họ </w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>tên</w:t></w:r><w:proofErr w:type="spellEnd"/></w:p>',
    );
    const out = bodyXmlOf(normalizeDocxTags(buf));
    expect(out).not.toContain('proofErr');
  });

  it('gộp placeholder bị tách run → detect nhận diện được', () => {
    // {soVanBan} bị Word tách: {soV | anBan}
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>Số </w:t></w:r><w:r><w:t>{soV</w:t></w:r><w:r><w:t>anBan}</w:t></w:r></w:p>',
    );
    const normalized = normalizeDocxTags(buf);
    expect(detectDocxVariables(normalized)).toEqual(['soVanBan']);
  });

  it('placeholder tiếng Việt tách run + proofErr → gộp + detect được (delimiter «»)', () => {
    const buf = makeRawDocx(
      '<w:p><w:r><w:t>«Họ tên </w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>người gửi»</w:t></w:r></w:p>',
    );
    const normalized = normalizeDocxTags(buf);
    expect(detectDocxVariables(normalized, { start: '«', end: '»' })).toEqual(['Họ tên người gửi']);
  });

  it('placeholder đã liền mạch → giữ nguyên detect được', () => {
    const buf = makeRawDocx('<w:p><w:r><w:t>{soVuAn}</w:t></w:r></w:p>');
    expect(detectDocxVariables(normalizeDocxTags(buf))).toEqual(['soVuAn']);
  });

  it('[review] buffer hỏng → trả lại nguyên buffer (không throw)', () => {
    const bad = Buffer.from('không phải docx');
    expect(normalizeDocxTags(bad)).toBe(bad);
  });
});
