/**
 * Filename sanitizer for v0.47 docx + xlsx outputs (PR2 single-file export,
 * PR3 batch ZIP export, PR4 Phụ lục xlsx export).
 *
 * Defends against:
 *   - Path traversal via /, \, ..  → stripped
 *   - Windows-reserved characters (?, %, *, :, |, ", <, >) → stripped
 *   - Control characters (\x00..\x1f) → stripped
 *   - Excel/CSV injection in zip entry listings (=, +, -, @, \t, \r at start) → '-prefixed
 *   - Pathologically long names → truncated to 200 chars
 *
 * Preserves Vietnamese diacritics (Đ, ơ, ê, etc.) via NFC normalization.
 */

const WHITELIST = /[^\p{L}\p{N}\p{M}\s._\-()[\]]/gu;
const EXCEL_INJECT = /^[=+\-@\t\r]/;
const MAX_LEN = 200;

export function sanitizeFilename(input: string): string {
  // 1. Normalize Unicode so Đơn (NFD) and Đơn (NFC) collapse to the same bytes.
  let s = input.normalize('NFC');

  // 2. Check for Excel/CSV injection on the original input — \t and \r would be
  //    erased by step 3's control-char strip, so this MUST come first.
  const needsExcelEscape = EXCEL_INJECT.test(s);

  // 3. Replace path separators and control characters with empty string.
  s = s.replace(/[\\/]/g, '');
  s = s.replace(/[\x00-\x1f]/g, '');

  // 4. Collapse any traversal segments.
  s = s.replace(/\.{2,}/g, '.');

  // 5. Whitelist: keep letters (including non-ASCII), digits, marks, whitespace,
  //    dot, underscore, hyphen, parentheses, brackets.
  s = s.replace(WHITELIST, '');

  // 6. Defeat Excel/CSV injection when this filename appears in a zip listing
  //    (PR3 batch export pipes through archiver).
  if (needsExcelEscape || EXCEL_INJECT.test(s)) {
    s = "'" + s;
  }

  // 7. Length cap.
  if (s.length > MAX_LEN) {
    s = s.slice(0, MAX_LEN);
  }

  // 8. Fallback for empty / pure-junk input.
  if (!s.trim() || s === "'") return 'untitled';

  return s;
}

export interface DocumentFilenameParts {
  /** Mã hồ sơ: Petition.stt / Case.caseCode / Incident.code. Có thể thiếu (caseCode nullable). */
  recordCode?: string | null;
  /** Tên mẫu tiếng Việt CÓ DẤU (DocumentTemplate.name) — KHÔNG dùng code viết hoa. */
  templateName?: string | null;
  /** Số văn bản engine cấp, dạng "0012/ĐX-PC02-Đ1". Chỉ phần số đầu được dùng. */
  documentNumber?: string | null;
  /** Mặc định 'docx'. */
  ext?: string;
}

/**
 * Tên file chứng từ "nhìn là hiểu": `Mã hồ sơ_Tên mẫu_Số văn bản.docx`.
 *
 *   DT-2026-36679_Phiếu đề xuất_0012.docx
 *
 * Nối theo kiểu LỌC-RỒI-JOIN: thành phần rỗng biến mất CÙNG dấu phân cách của nó,
 * nên không bao giờ có `_` thừa ở đầu/cuối hay `__` ở giữa:
 *
 *   thiếu mã hồ sơ  → Phiếu đề xuất_0012.docx     (KHÔNG phải _Phiếu đề xuất_0012)
 *   thiếu số VB     → DT-2026-36679_Phiếu đề xuất.docx
 *   thiếu cả hai    → Phiếu đề xuất.docx
 *
 * Giữ nguyên dấu tiếng Việt — `sanitizeFilename` whitelist `\p{L}` nên dấu sống sót,
 * và `resolveFilename` phía frontend đọc `filename*=UTF-8''` để dấu tới được đĩa.
 */
export function buildDocumentFilename(parts: DocumentFilenameParts): string {
  // ext cũng phải sạch: caller truyền '../evil' sẽ tái chèn path separator SAU khi stem
  // đã được làm sạch.
  const ext =
    sanitizeFilename(parts.ext ?? 'docx').replace(/[.\s]/g, '') || 'docx';
  const stem = [
    parts.recordCode?.trim(),
    parts.templateName?.trim(),
    shortDocNumber(parts.documentNumber),
  ]
    .filter((p): p is string => !!p)
    .join('_');
  // Cắt theo STEM (chừa chỗ cho ".ext"), KHÔNG cắt cả tên đã có đuôi — cắt sau khi nối
  // sẽ xén mất chính phần mở rộng và file không mở được.
  const maxStem = MAX_LEN - ext.length - 1;
  const clean = sanitizeFilename(stem).slice(0, maxStem);
  return `${clean}.${ext}`;
}

/**
 * Rút phần SỐ từ số văn bản để đưa vào tên file.
 *
 * Không dùng `split('/')[0]`: series do admin cấu hình, thứ tự segment không cố định.
 * `"0012/ĐX-PC02-Đ1"` → `"0012"` nhưng `"ĐX-PC02/0012"` cũng phải ra `"0012"` — nếu lấy
 * segment đầu sẽ ra `"ĐX-PC02"`, giống hệt nhau ở mọi hồ sơ và MẤT phần định danh thật.
 */
function shortDocNumber(raw?: string | null): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  // Nhóm chữ số dài nhất là số thứ tự trong sổ (0012, 00015…).
  const groups = s.match(/\d+/g);
  if (!groups?.length) return s.split('/')[0]?.trim() || undefined;
  return groups.reduce((a, b) => (b.length >= a.length ? b : a));
}

/**
 * Chống trùng tên trong 1 file .zip. `archiver.append` KHÔNG chặn entry trùng tên —
 * nó ghi cả hai, và công cụ giải nén thường ghi đè file trước, tức MẤT dữ liệu âm thầm.
 *
 * Cần thiết vì tên file nay dựa trên `template.name` (không unique) thay vì `template.code`
 * (unique): admin upload bản mới cùng tên là chuyện có thật.
 *
 * So khớp KHÔNG phân biệt hoa/thường vì Windows/NTFS coi `A.docx` và `a.docx` là một file.
 */
export function dedupeFilenames(names: string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    let n = 1;
    while (taken.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${stem}-${n}${ext}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}
