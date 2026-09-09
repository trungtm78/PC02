import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { detectDocxVariables, Delimiters } from '../docx-variables.util';
import { danhDauXuongDong, ngatDoanNhuHeCu } from './ngat-doan-he-cu';
import { RenderInput, TemplateRenderer } from './template-renderer.interface';

/**
 * Renderer .docx dựa trên docxtemplater. Truyền delimiter của template vào engine
 * (hỗ trợ ký tự mở/đóng tùy chỉnh). `nullGetter`='' để biến thiếu ra rỗng, không
 * `[undefined]`. Buffer fileBytes lấy từ DB.
 */
export class DocxRenderer implements TemplateRenderer {
  readonly format = 'DOCX';

  detectVariables(buffer: Buffer, delimiters: Delimiters): string[] {
    return detectDocxVariables(buffer, delimiters);
  }

  render({ buffer, data, delimiters, kieuXuongDong = 'mem' }: RenderInput): Buffer {
    const nhuHeCu = kieuXuongDong === 'doan-he-cu';
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      // Kiểu hệ cũ tự lo phần xuống dòng: nó đánh dấu trước khi dựng rồi tách ĐOẠN sau khi
      // dựng. Bật `linebreaks` ở đây nữa thì engine nuốt mất dấu ấy thành `<w:br/>`.
      linebreaks: !nhuHeCu,
      nullGetter: () => '',
      delimiters: { start: delimiters.start, end: delimiters.end },
    });
    doc.render(nhuHeCu ? danhDauXuongDong(data) : data);
    const ra = doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
    return nhuHeCu ? ngatDoanNhuHeCu(ra) : ra;
  }
}
