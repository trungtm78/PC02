/**
 * Telling "this feature is switched off" apart from "that record is gone".
 *
 * `FeatureFlagGuard` answers a gated route with 404 — deliberately, so a
 * disabled feature does not advertise itself with a distinct status code — but
 * puts `error: 'FEATURE_DISABLED'` in the body. Without reading that body every
 * screen showed its own generic not-found message, which reads to an officer
 * like their case file vanished rather than like an administrator flipped a
 * switch.
 */

/**
 * WIRE FORMAT — must match `FEATURE_DISABLED_ERROR` in
 * `backend/src/feature-flags/guards/feature-flag.guard.ts`. The mobile client
 * carries its own copy, and an installed APK cannot be corrected by a redeploy.
 */
export const FEATURE_DISABLED_ERROR = 'FEATURE_DISABLED';

/** Name of the window event the API interceptor broadcasts. */
export const FEATURE_DISABLED_EVENT = 'pc02:feature-disabled';

export interface FeatureDisabledDetail {
  /** Flag key, e.g. `"cases"`. */
  feature: string;
  /** Vietnamese sentence from the server, ready to display. */
  message: string;
}

interface MaybeAxiosError {
  response?: {
    status?: number;
    data?: {
      error?: unknown;
      feature?: unknown;
      message?: unknown;
      // Nest wraps a thrown object literal under `message` on some paths, so
      // accept both shapes rather than depending on which one the framework
      // happens to produce.
      [key: string]: unknown;
    };
  };
}

function body(error: unknown): Record<string, unknown> | undefined {
  const data = (error as MaybeAxiosError)?.response?.data;
  if (!data || typeof data !== 'object') return undefined;
  const nested = (data as { message?: unknown }).message;
  if (nested && typeof nested === 'object') {
    return nested as Record<string, unknown>;
  }
  return data as Record<string, unknown>;
}

/**
 * Mã nằm ở đâu trong thân lỗi — phải chấp nhận HAI dạng.
 *
 * `FeatureFlagGuard` ném `{ statusCode, error: 'FEATURE_DISABLED', feature,
 * message }` (dạng phẳng). Nhưng `GlobalExceptionFilter` BỌC LẠI mọi
 * `HttpException` thành `{ success: false, error: { code, message, details } }`
 * — mã phẳng trở thành `error.code`.
 *
 * Client chỉ đọc dạng phẳng nên **chưa bao giờ nhận diện được** tính năng bị
 * tắt: nó luôn rơi vào nhánh lỗi chung. Không ai thấy vì gate chưa bao giờ chạy
 * (ADR-0018) — sửa gate xong mới lộ ra hợp đồng hai đầu không khớp nhau.
 *
 * Giữ cả hai nhánh chứ không chỉ đổi sang dạng bọc: dạng phẳng vẫn tới được
 * client nếu có đường nào bỏ qua filter.
 */
function featureDisabledCode(b: Record<string, unknown> | undefined): unknown {
  if (!b) return undefined;
  if (b.error === FEATURE_DISABLED_ERROR) return b.error;
  const nested = b.error;
  if (nested && typeof nested === 'object') {
    return (nested as Record<string, unknown>).code;
  }
  return undefined;
}

export function isFeatureDisabledError(error: unknown): boolean {
  const status = (error as MaybeAxiosError)?.response?.status;
  if (status !== 404) return false;
  return featureDisabledCode(body(error)) === FEATURE_DISABLED_ERROR;
}

export function extractFeatureDisabled(
  error: unknown,
): FeatureDisabledDetail {
  const b = body(error) ?? {};
  // Dạng bọc đặt `message` bên trong `error`; dạng phẳng đặt ở ngoài.
  const wrapped =
    b.error && typeof b.error === 'object'
      ? (b.error as Record<string, unknown>)
      : {};
  const feature =
    typeof b.feature === 'string'
      ? b.feature
      : typeof wrapped.feature === 'string'
        ? wrapped.feature
        : '';
  const rawMessage =
    typeof b.message === 'string' && b.message.length > 0
      ? b.message
      : typeof wrapped.message === 'string'
        ? wrapped.message
        : '';
  const message = rawMessage.length > 0 ? rawMessage : 'Tính năng này hiện đang tắt.';
  return { feature, message };
}
