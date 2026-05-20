/**
 * Multi-field login identifier classifier.
 *
 * Phát hiện shape của input → trả về field cụ thể để query (`findUnique`).
 * KHÔNG dùng `findFirst+OR` vì collision DoS attack (Eng review finding):
 * User A `workId='0934314279'` + User B `phone='0934314279'` → OR query trả random
 * → User B bị lockout vĩnh viễn vì stranger pick cùng string.
 *
 * Shape precedence (mutually exclusive):
 *   - email:    `<local>@<domain>.<tld>` — pattern email cơ bản, lowercase value
 *   - workId:   `XXX-XXX` (vd `277-794`) HOẶC `PREFIX-PREFIX-NNN` (vd `PC02-DTV-001`)
 *   - phone:    bắt đầu `0` hoặc `+`, 9-15 chữ số sau normalize, canonicalize về +84
 *   - username: fallback cho mọi shape khác
 *
 * Validate trong admin form: username KHÔNG được phép có dạng phone/workId/email
 * (chống user cố tình tạo username collision với identifier shape).
 */
export type IdentifierField = 'email' | 'phone' | 'workId' | 'username';

export interface ClassifiedIdentifier {
  field: IdentifierField;
  value: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// v0.27 expand: accept legacy XXX-XXX (vd 277-794) AND prefixed shape PC02-DTV-NNN
// (seed-sample-data + seed-dtv-user dùng PC02-DTV-001..005). Cả 2 đều @unique trong DB.
// PC02 = uppercase + digit mixed → [A-Z0-9]{2,8}; DTV = pure uppercase. Both allowed.
const WORKID_PATTERN = /^(?:\d{3}-\d{3}|[A-Z][A-Z0-9]{1,7}-[A-Z][A-Z0-9]{1,7}-\d{2,4})$/;
// v0.28: workId thuần số 3-8 chars — Mã cán bộ ngành công an (vd `33445433`, `001`).
// An toàn không collision phone (yêu cầu ≥9 chars sau normalize).
// workId 9+ chars sẽ route phone shape, được handle bằng fallback chain ở auth.service.
const WORKID_DIGITS_PATTERN = /^\d{3,8}$/;
const PHONE_NORMALIZE_PATTERN = /[\s.-]/g;
const PHONE_SHAPE_PATTERN = /^\+?[0-9]{9,15}$/;

/**
 * v0.27: Canonicalize Vietnamese mobile → +84 prefix.
 *   "0934314279"   → "+84934314279"
 *   "84934314279"  → "+84934314279"
 *   "+84934314279" → "+84934314279" (no-op)
 *   "+1555..."     → "+1555..." (foreign, preserve as-is)
 */
export function canonicalizeVietnamPhone(normalized: string): string {
  if (normalized.startsWith('+')) return normalized;
  if (normalized.startsWith('84') && normalized.length >= 11) return '+' + normalized;
  if (normalized.startsWith('0')) return '+84' + normalized.substring(1);
  return '+' + normalized;
}

export function classifyIdentifier(input: string): ClassifiedIdentifier {
  const trimmed = input.trim();
  if (EMAIL_PATTERN.test(trimmed)) {
    return { field: 'email', value: trimmed.toLowerCase() };
  }
  if (WORKID_PATTERN.test(trimmed) || WORKID_DIGITS_PATTERN.test(trimmed)) {
    return { field: 'workId', value: trimmed };
  }
  const normalizedPhone = trimmed.replace(PHONE_NORMALIZE_PATTERN, '');
  if (PHONE_SHAPE_PATTERN.test(normalizedPhone)) {
    return { field: 'phone', value: canonicalizeVietnamPhone(normalizedPhone) };
  }
  return { field: 'username', value: trimmed };
}
