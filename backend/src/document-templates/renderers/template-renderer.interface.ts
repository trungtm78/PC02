import { Delimiters } from '../docx-variables.util';

/** Đầu vào render: file template + data đã resolve + cặp delimiter của template. */
export interface RenderInput {
  buffer: Buffer;
  data: Record<string, string>;
  delimiters: Delimiters;
  /**
   * Ô nhiều dòng dựng thành gì.
   *
   * `mem` — ngắt dòng mềm `<w:br/>`, mặc định, dùng cho bộ mẫu tố tụng của hệ mới.
   * `doan-he-cu` — mỗi dòng một ĐOẠN Word như hệ cũ in ra; chỉ dùng cho mẫu `HE_CU_*`, nơi có
   * bản gốc để đối chiếu. Áp kiểu hệ cũ cho mẫu hệ mới là chép thụt đầu dòng 709 twip của một
   * hệ khác vào chỗ không ai yêu cầu.
   */
  kieuXuongDong?: 'mem' | 'doan-he-cu';
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
