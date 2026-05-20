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
          message: wrappedMessage || messages[0] || fallback,
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
