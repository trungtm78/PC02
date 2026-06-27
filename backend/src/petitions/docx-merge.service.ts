import { Injectable } from '@nestjs/common';
import PizZip from 'pizzip';

/** Paragraph chứa ngắt trang — chèn giữa các mẫu khi gộp. */
const PAGE_BREAK_P = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/**
 * Gộp nhiều .docx (đã render) thành 1 .docx, ngắt trang giữa các mẫu.
 *
 *   <body A − sectPr> [pageBreak] <body B − sectPr> ... [pageBreak] <body N − sectPr> <sectPr A>
 *
 * Giả định (đã verify): mọi mẫu sinh từ CÙNG bộ template nội bộ, TEXT-ONLY (0
 * image/hyperlink relationship riêng) → chỉ cần nối nội dung <w:body>, giữ
 * nguyên parts của mẫu đầu (styles/numbering/theme/settings/rels). KHÔNG remap
 * relationship. Nếu sau này template có image/hyperlink riêng phải mở rộng
 * (merge word/_rels + [Content_Types] + remap r:id).
 *
 * Known-limitation: danh sách auto-number cùng numId có thể tiếp số qua các mẫu
 * (mẫu chứng từ hành chính hầu như không dùng auto-list) → chấp nhận.
 */
@Injectable()
export class DocxMergeService {
  merge(buffers: Buffer[]): Buffer {
    if (!buffers || buffers.length === 0) {
      throw new Error('DocxMergeService.merge: cần ít nhất 1 buffer .docx');
    }
    const baseZip = new PizZip(buffers[0]);
    const baseXml = this.readDocumentXml(baseZip);
    const baseSplit = this.splitBody(baseXml);

    const contents = buffers.map((buf, i) => {
      const xml = i === 0 ? baseXml : this.readDocumentXml(new PizZip(buf));
      return this.splitBody(xml).content;
    });

    // Nội dung body mới: nối các mẫu bằng ngắt trang, sectPr của mẫu đầu đặt cuối.
    const mergedInner = contents.join(PAGE_BREAK_P) + baseSplit.sectPr;
    const newXml = this.replaceBodyInner(baseXml, mergedInner);

    baseZip.file('word/document.xml', newXml);
    return baseZip.generate({ type: 'nodebuffer' }) as Buffer;
  }

  private readDocumentXml(zip: PizZip): string {
    const f = zip.file('word/document.xml');
    if (!f) {
      throw new Error('DocxMergeService: .docx thiếu word/document.xml');
    }
    return f.asText();
  }

  /** Tách body thành { content (trừ sectPr cuối), sectPr cuối }. */
  private splitBody(xml: string): { content: string; sectPr: string } {
    const { start, end } = this.bodyBounds(xml);
    const inner = xml.slice(start, end);
    // sectPr cuối body = section properties của toàn doc; phần còn lại là nội dung.
    const sectOpen = inner.lastIndexOf('<w:sectPr');
    if (sectOpen === -1) {
      return { content: inner, sectPr: '' };
    }
    return { content: inner.slice(0, sectOpen), sectPr: inner.slice(sectOpen) };
  }

  private replaceBodyInner(xml: string, mergedInner: string): string {
    const { start, end } = this.bodyBounds(xml);
    return xml.slice(0, start) + mergedInner + xml.slice(end);
  }

  /** Vị trí bắt đầu (sau `<w:body…>`) và kết thúc (trước `</w:body>`) nội dung body. */
  private bodyBounds(xml: string): { start: number; end: number } {
    const bodyOpen = xml.indexOf('<w:body');
    if (bodyOpen === -1) {
      throw new Error('DocxMergeService: document.xml thiếu <w:body>');
    }
    const start = xml.indexOf('>', bodyOpen) + 1;
    const end = xml.lastIndexOf('</w:body>');
    if (end === -1 || end < start) {
      throw new Error('DocxMergeService: document.xml thiếu </w:body>');
    }
    return { start, end };
  }
}
