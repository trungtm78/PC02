import axios from 'axios';

// Backend (http-exception.filter.ts) wraps every error response as:
//   { success: false, error: { code, message, details: [] }, timestamp, path }
// `details` carries class-validator messages when status is 400.
//
// Older NestJS default shape may still appear in odd edge cases:
//   { statusCode, message: string | string[], error }
// We accept both, plus axios network errors and raw Error objects.

export interface NormalizedApiError {
  message: string;       // Single primary message (toast / alert)
  messages: string[];    // Validation details split out for form-level lists
  code?: string;         // e.g. 'BAD_REQUEST', 'CONFLICT'
  status?: number;       // HTTP status (0 = no response / network)
}

const DEFAULT_FALLBACK = 'Có lỗi xảy ra';
const NETWORK_FALLBACK = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.';

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean);
}

/** The words the server uses when it only knows that validation failed; the reasons are in `details`. */
const GENERIC_VALIDATION_MESSAGE = 'Validation failed';

/**
 * The one line a screen shows. The server's own message wins, except when it is just "Validation failed": that says
 * nothing, so show the first real reason (and how many more there are) instead of hiding every cause behind it.
 */
function primaryMessage(wrapped: string, details: string[], firstMessage: string, fallback: string): string {
  if (wrapped === GENERIC_VALIDATION_MESSAGE && details.length > 0) {
    const more = details.length > 1 ? ` (và ${details.length - 1} lỗi khác)` : '';
    return `Dữ liệu chưa hợp lệ: ${details[0]}${more}`;
  }
  return wrapped || firstMessage || fallback;
}

export function extractApiError(err: unknown, fallback = DEFAULT_FALLBACK): NormalizedApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as Record<string, unknown> | undefined;

    if (data && typeof data === 'object') {
      // Current wrapped shape — { error: { code, message, details } }
      const wrapped = data.error;
      if (wrapped && typeof wrapped === 'object') {
        const w = wrapped as Record<string, unknown>;
        const wrappedMessage = typeof w.message === 'string' ? w.message : '';
        const detailMessages = toStringArray(w.details);
        const messages =
          detailMessages.length > 0
            ? detailMessages
            : [wrappedMessage || fallback];
        return {
          message: primaryMessage(wrappedMessage, detailMessages, messages[0] || fallback, fallback),
          messages,
          code: typeof w.code === 'string' ? w.code : undefined,
          status,
        };
      }

      // Legacy NestJS shape — message at top level
      if (data.message !== undefined) {
        if (Array.isArray(data.message)) {
          const messages = toStringArray(data.message);
          return {
            message: messages[0] || fallback,
            messages: messages.length > 0 ? messages : [fallback],
            status,
          };
        }
        const msg = typeof data.message === 'string' ? data.message : fallback;
        return { message: msg, messages: [msg], status };
      }
    }

    // No response body — network error, CORS, timeout
    if (!err.response) {
      return { message: NETWORK_FALLBACK, messages: [NETWORK_FALLBACK], status: 0 };
    }

    // Response existed but had no parseable error info — use HTTP status as hint
    return { message: fallback, messages: [fallback], status };
  }

  if (err instanceof Error && err.message) {
    return { message: err.message, messages: [err.message] };
  }

  return { message: fallback, messages: [fallback] };
}

/**
 * Lời hiện cho một lỗi 409. Máy chủ phân biệt từng trường hợp (trùng giá trị `DUPLICATE_VALUE`, hồ sơ vừa bị người
 * khác sửa, …) và kèm lời đúng; form chỉ dùng câu dự phòng khi máy chủ không nói gì. Trước 19/09/2026 form Vụ án /
 * Vụ việc coi MỌI 409 là "người khác vừa sửa, tải lại trang".
 */
export function loiXungDot(err: unknown, duPhong: string): string {
  const { message } = extractApiError(err, '');
  return message || duPhong;
}
