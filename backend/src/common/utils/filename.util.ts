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
