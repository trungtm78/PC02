/**
 * Audit log utility functions — pure, no DI dependency.
 *
 * v0.29: tách ra khỏi audit.service.ts để dễ unit-test + reusable.
 * KHÔNG inject Prisma hay AuditService — chỉ pure functions.
 */

/**
 * v0.29: Regex bao trùm mọi PII field name.
 * Match: passwordHash, refreshTokenHash, totpSecret, enrollmentTokenHash,
 *        backupCodes, backupCodeSalts, magicLinkTokenHash, lastOtpCode,
 *        twoFaSecret, 2faPendingToken, recoveryCodes, sessionTokenHash, etc.
 *
 * Strategy: pattern-based (regex) thay vì literal allow-list. Future-proof khi
 * Prisma schema thêm fields mới có shape `*Hash`, `*Secret`, `*Token`, etc.
 */
export const PII_PATTERN = /(hash|secret|token|password|backup_?code|recovery|otp_?code|2fa)/i;

/**
 * Bỏ tất cả PII keys khỏi flat object.
 *
 * - Iterate top-level keys.
 * - Skip key match PII_PATTERN (KHÔNG redact thành `'***'` — không leak existence).
 * - Return new object; KHÔNG mutate input.
 *
 * @param obj — Plain object or null/undefined.
 * @returns Object cùng shape nhưng KHÔNG có PII keys.
 */
export function sanitizePII<T extends Record<string, unknown>>(
  obj: T | null | undefined,
): Partial<T> {
  if (!obj) return {} as Partial<T>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_PATTERN.test(key)) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * v0.29: Recursive sanitize cho mọi audit metadata.
 *
 * Applied trong AuditService.log() để mọi audit write (direct hay qua wrapUpdate)
 * đều redact PII. Recursive walk nested objects (e.g., metadata.before/after).
 *
 * Edge cases:
 * - Arrays: walk each element, return new array.
 * - Primitives (string/number/bool/null): return as-is.
 * - Nested object: filter PII keys + recurse.
 * - Circular reference: caught by JSON.stringify downstream (acceptable for v0.29).
 */
export function sanitizeMetadataRecursive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataRecursive);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_PATTERN.test(k)) continue;
      out[k] = sanitizeMetadataRecursive(v);
    }
    return out;
  }
  return value;
}

export type FieldChangeType = 'added' | 'removed' | 'modified';

export interface ChangedField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: FieldChangeType;
}

/**
 * Compute field-level diff giữa 2 versions của 1 entity.
 *
 * Skip strategy:
 * - PII fields (regex PII_PATTERN match key name) — never appear in diff.
 * - Meta fields (`id`, `createdAt`, `updatedAt`) — noise, not user-actionable.
 *
 * Change detection:
 * - before === null AND after !== null → 'added' (CREATE flow)
 * - before !== null AND after === null → 'removed' (DELETE flow)
 * - oldValue !== newValue (via JSON.stringify deep equality) → 'modified'
 *
 * Nested objects: dùng JSON.stringify so sánh (đủ cho v0.29; deep-equal lib có
 * thể add sau nếu cần performance). Acceptable cho audit log payloads nhỏ.
 *
 * @param before — Snapshot trước thay đổi, hoặc null nếu CREATE.
 * @param after — Snapshot sau thay đổi, hoặc null nếu DELETE.
 * @returns Array các field changes, sorted theo insertion order (union keys).
 */
export function computeFieldDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): ChangedField[] {
  const SKIP_META = new Set(['id', 'createdAt', 'updatedAt']);
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const result: ChangedField[] = [];
  for (const field of fields) {
    if (SKIP_META.has(field) || PII_PATTERN.test(field)) continue;
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    if (oldValue === null && newValue !== null) {
      result.push({ field, oldValue: null, newValue, changeType: 'added' });
    } else if (oldValue !== null && newValue === null) {
      result.push({ field, oldValue, newValue: null, changeType: 'removed' });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      result.push({ field, oldValue, newValue, changeType: 'modified' });
    }
  }
  return result;
}
