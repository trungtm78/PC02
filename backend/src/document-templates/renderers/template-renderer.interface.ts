import { Delimiters } from '../docx-variables.util';

/** Đầu vào render: file template + data đã resolve + cặp delimiter của template. */
export interface RenderInput {
  buffer: Buffer;
  data: Record<string, string>;
  delimiters: Delimiters;
}

/**
 * Port render template theo ĐỊNH DẠNG. Vòng này chỉ impl DOCX; XLSX/khác cắm thêm
 * impl mới mà KHÔNG đụng lớp mapping/field-catalog. `DynamicExportService` chọn
 * renderer theo `template.format`.
 */
export interface TemplateRenderer {
  /** Định dạng renderer phục vụ (vd 'DOCX'). */
  readonly format: string;
  /** Phát hiện placeholder trong file theo delimiter (preview/validate). */
  detectVariables(buffer: Buffer, delimiters: Delimiters): string[];
  /** Điền data vào template → buffer kết quả. */
  render(input: RenderInput): Buffer;
}
