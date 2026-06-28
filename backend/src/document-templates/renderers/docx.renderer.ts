import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { detectDocxVariables, Delimiters } from '../docx-variables.util';
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

  render({ buffer, data, delimiters }: RenderInput): Buffer {
    const zip = new PizZip(buffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: { start: delimiters.start, end: delimiters.end },
    });
    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
  }
}
