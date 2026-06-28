import PizZip from 'pizzip';
import { DocxRenderer } from './docx.renderer';
import { resolveRenderer } from './index';
import { BadRequestException } from '@nestjs/common';

/** .docx tối thiểu HỢP LỆ cho docxtemplater (cần [Content_Types].xml + _rels). */
function makeDocx(bodyText: string): Buffer {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${bodyText}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}

function textOf(buf: Buffer): string {
  return new PizZip(buf).file('word/document.xml')!.asText();
}

describe('DocxRenderer', () => {
  const r = new DocxRenderer();

  it('render delimiter mặc định { } điền data', () => {
    const out = r.render({
      buffer: makeDocx('Số {soVanBan} của {ten}'),
      data: { soVanBan: '123', ten: 'An' },
      delimiters: { start: '{', end: '}' },
    });
    expect(textOf(out)).toContain('Số 123 của An');
  });

  it('render delimiter tùy chỉnh [[ ]]', () => {
    const out = r.render({
      buffer: makeDocx('Kính gửi [[ten]]'),
      data: { ten: 'Trần Bình' },
      delimiters: { start: '[[', end: ']]' },
    });
    expect(textOf(out)).toContain('Kính gửi Trần Bình');
  });

  it('biến thiếu → rỗng (nullGetter), không [undefined]', () => {
    const out = r.render({
      buffer: makeDocx('X {thieu} Y'),
      data: {},
      delimiters: { start: '{', end: '}' },
    });
    expect(textOf(out)).toContain('X  Y');
    expect(textOf(out)).not.toContain('undefined');
  });

  it('detectVariables ủy quyền theo delimiter', () => {
    expect(r.detectVariables(makeDocx('[[a]] [[b]]'), { start: '[[', end: ']]' })).toEqual(['a', 'b']);
  });

  it('resolveRenderer: DOCX → DocxRenderer; format lạ → 400', () => {
    expect(resolveRenderer('DOCX')).toBeInstanceOf(DocxRenderer);
    expect(resolveRenderer(undefined)).toBeInstanceOf(DocxRenderer);
    expect(() => resolveRenderer('PDF')).toThrow(BadRequestException);
  });
});
