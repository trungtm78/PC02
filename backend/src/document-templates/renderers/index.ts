import { BadRequestException } from '@nestjs/common';
import { TemplateRenderer } from './template-renderer.interface';
import { DocxRenderer } from './docx.renderer';

export * from './template-renderer.interface';
export * from './document-converter.interface';
export { DocxRenderer } from './docx.renderer';

/** Registry renderer theo format. Thêm XLSX/khác = đăng ký impl mới ở đây. */
const RENDERERS: Record<string, TemplateRenderer> = {
  DOCX: new DocxRenderer(),
};

/** Lấy renderer theo `template.format` (mặc định DOCX). Format chưa hỗ trợ → 400. */
export function resolveRenderer(format: string | null | undefined): TemplateRenderer {
  const key = (format ?? 'DOCX').toUpperCase();
  const r = RENDERERS[key];
  if (!r) throw new BadRequestException(`Định dạng template "${format}" chưa được hỗ trợ`);
  return r;
}
