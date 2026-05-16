/**
 * Multi-field login identifier classifier.
 *
 * Phát hiện shape của input → trả về field cụ thể để query (`findUnique`).
 * KHÔNG dùng `findFirst+OR` vì collision DoS attack (Eng review finding):
 * User A `workId='0934314279'` + User B `phone='0934314279'` → OR query trả random
 * → User B bị lockout vĩnh viễn vì stranger pick cùng string.
 *
 * Shape precedence (mutually exclusive):
 *   - email:    `<local>@<domain>.<tld>` — pattern email cơ bản
 *   - phone:    bắt đầu `0` hoặc `+`, 9-15 chữ số sau khi normalize whitespace/dot/dash
 *   - workId:   `XXX-XXX` (ví dụ `277-794`) — bắt buộc literal dash
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
const WORKID_PATTERN = /^\d{3}-\d{3}$/;
const PHONE_NORMALIZE_PATTERN = /[\s.-]/g;
const PHONE_SHAPE_PATTERN = /^\+?[0-9]{9,15}$/;

export function classifyIdentifier(input: string): ClassifiedIdentifier {
  const trimmed = input.trim();
  if (EMAIL_PATTERN.test(trimmed)) {
    return { field: 'email', value: trimmed.toLowerCase() };
  }
  if (WORKID_PATTERN.test(trimmed)) {
    return { field: 'workId', value: trimmed };
  }
  const normalizedPhone = trimmed.replace(PHONE_NORMALIZE_PATTERN, '');
  if (PHONE_SHAPE_PATTERN.test(normalizedPhone)) {
    return { field: 'phone', value: normalizedPhone };
  }
  return { field: 'username', value: trimmed };
}
