/**
 * Port chuyển đổi định dạng đầu ra (vd DOCX → PDF qua LibreOffice/Gotenberg headless).
 *
 * ROADMAP — CHƯA impl trong vòng này (chỉ xuất .docx). Interface định nghĩa sẵn để khi
 * thêm PDF/XLSX chỉ cần cắm impl + đăng ký, KHÔNG viết lại lớp render/mapping.
 */
export interface DocumentConverter {
  /** Định dạng nguồn → đích converter hỗ trợ (vd 'DOCX'→'PDF'). */
  readonly from: string;
  readonly to: string;
  convert(buffer: Buffer): Promise<Buffer>;
}
