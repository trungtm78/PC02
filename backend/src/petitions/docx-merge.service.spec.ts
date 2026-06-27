import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { DocxMergeService } from './docx-merge.service';

/**
 * DocxMergeService gộp nhiều .docx (đã render) thành 1 .docx, ngắt trang giữa
 * các mẫu. Test dùng template thật (text-only, 0 page-break sẵn) làm input.
 *
 *   [docx A] + [docx B] + [docx C]
 *        │ merge
 *        ▼
 *   <body A> [pageBreak] <body B> [pageBreak] <body C> <sectPr A>
 *   → N-1 page break, đúng 1 sectPr (của A), chứa nội dung cả N.
 */
function tpl(name: string): Buffer {
  return fs.readFileSync(
    path.join(__dirname, '../../templates/docx', `${name}.docx`),
  );
}
function docXml(buf: Buffer): string {
  return new PizZip(buf).file('word/document.xml')!.asText();
}
function countRe(s: string, re: RegExp): number {
  return (s.match(re) || []).length;
}

describe('DocxMergeService', () => {
  const svc = new DocxMergeService();
  const A = tpl('PHIEU_DE_XUAT'); // marker {deXuat}
  const B = tpl('BIEN_NHAN'); //     marker {dinhKem}
  const C = tpl('THONG_BAO_TRA_LAI'); // marker {ghiTen}

  it('gộp 3 mẫu → 1 docx hợp lệ: 2 page break, đúng 1 sectPr, chứa nội dung cả 3', () => {
    const out = svc.merge([A, B, C]);
    const xml = docXml(out);
    expect(countRe(xml, /<w:br w:type="page"\/>/g)).toBe(2); // N-1
    expect(countRe(xml, /<w:sectPr[\s>]/g)).toBe(1); // chỉ giữ sectPr của mẫu đầu
    expect(xml).toContain('{deXuat}'); // PHIEU_DE_XUAT
    expect(xml).toContain('{dinhKem}'); // BIEN_NHAN
    expect(xml).toContain('{ghiTen}'); // THONG_BAO_TRA_LAI
    // docx mở lại được (PizZip không throw + có document.xml)
    expect(xml).toContain('</w:document>');
  });

  it('1 mẫu → trả docx hợp lệ, 0 page break, 1 sectPr', () => {
    const out = svc.merge([B]);
    const xml = docXml(out);
    expect(countRe(xml, /<w:br w:type="page"\/>/g)).toBe(0);
    expect(countRe(xml, /<w:sectPr[\s>]/g)).toBe(1);
    expect(xml).toContain('{dinhKem}');
  });

  it('mảng rỗng → throw', () => {
    expect(() => svc.merge([])).toThrow();
  });
});
