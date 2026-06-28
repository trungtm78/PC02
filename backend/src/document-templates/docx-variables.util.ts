import PizZip from 'pizzip';

/** Cặp ký tự mở/đóng placeholder của 1 template (admin khai báo lúc upload). */
export interface Delimiters {
  start: string;
  end: string;
}

/** Delimiter mặc định `{ }` — giữ tương thích ngược cho mọi template hiện hữu. */
export const DEFAULT_DELIMITERS: Delimiters = { start: '{', end: '}' };

/** Escape ký tự đặc biệt của regex để delimiter do admin chọn (vd `[[`, `«`) dùng được như literal. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Trích tên biến placeholder duy nhất từ `word/document.xml` của 1 buffer .docx,
 * theo cặp delimiter của template (mặc định `{ }`).
 * - Giữ thứ tự xuất hiện, loại trùng.
 * - Bỏ qua placeholder rỗng / chỉ khoảng trắng.
 * - Buffer hỏng / không phải zip → trả `[]` (không throw; MIME đã validate ở controller).
 *
 * Lưu ý: text trong docx có thể bị tách run (Word) → chuẩn hóa file lúc upload
 * (docx-normalize.util) trước khi gọi để placeholder tiếng Việt nhận diện ổn định.
 */
export function detectDocxVariables(
  buffer: Buffer,
  delimiters: Delimiters = DEFAULT_DELIMITERS,
): string[] {
  let xml = '';
  try {
    const zip = new PizZip(buffer);
    // Quét document.xml + header*/footer*.xml → placeholder ở đầu/chân trang cũng nhận
    // (docxtemplater render mọi part bằng cùng data object) — tránh blank header/footer.
    const parts = Object.keys(zip.files).filter((n) =>
      /^word\/(document\.xml|header\d*\.xml|footer\d*\.xml)$/.test(n),
    );
    if (parts.length === 0 && zip.file('word/document.xml')) parts.push('word/document.xml');
    xml = parts.map((n) => zip.file(n)?.asText() ?? '').join('\n');
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  // Lazy match giữa start…end; escape delimiter để dùng literal (vd `[[`, `«`).
  const re = new RegExp(
    `${escapeRegExp(delimiters.start)}([\\s\\S]*?)${escapeRegExp(delimiters.end)}`,
    'g',
  );
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
