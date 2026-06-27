import PizZip from 'pizzip';

/**
 * Trích tên biến `{ten}` duy nhất từ `word/document.xml` của 1 buffer .docx.
 * - Giữ thứ tự xuất hiện, loại trùng.
 * - Bỏ qua `{}` rỗng / chỉ khoảng trắng.
 * - Buffer hỏng / không phải zip → trả `[]` (không throw; MIME đã validate ở controller).
 *
 * Lưu ý: text trong docx có thể bị tách run, nên placeholder phức tạp do admin
 * soạn liền mạch trong Word; cơ chế này phủ placeholder `{ten}` đơn giản.
 */
export function detectDocxVariables(buffer: Buffer): string[] {
  let xml = '';
  try {
    const zip = new PizZip(buffer);
    xml = zip.file('word/document.xml')?.asText() ?? '';
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = m[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
