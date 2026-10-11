/**
 * `crypto.randomUUID()` only exists in a secure context (HTTPS or localhost) — on
 * plain HTTP, which is what production currently serves (no TLS domain yet), it's
 * `undefined` and throws "is not a function". Confirmed live via monkey test
 * 12/10/2026: crashed `IncidentFormPage` on every render (`useRef(globalThis.
 * crypto.randomUUID())` evaluates its argument every render, not just the first)
 * and `IncidentHandoffPanel` the same way via `useState(() => crypto.randomUUID())`.
 *
 * `crypto.getRandomValues()` has no such restriction, so build a v4 UUID from it
 * when `randomUUID` isn't available instead of crashing — same idea
 * `frontend/src/lib/chiaSePhien.ts#taoId()` already used in one place, now
 * centralized so every new idempotency/request-key call site gets it for free.
 */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
