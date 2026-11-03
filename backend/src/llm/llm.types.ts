/**
 * OPENAI and SELF_HOSTED are served by the same OpenAI-compatible adapter, but they are different kinds:
 * OPENAI is a foreign cloud (a cross-border transfer of personal data), SELF_HOSTED is the unit's own server.
 */
export type ProviderKind = 'ANTHROPIC' | 'GEMINI' | 'OPENAI' | 'SELF_HOSTED';

export interface LlmImage {
  /** A single-page PDF is sent in the same list as the images; providers that read PDFs take it natively. */
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  dataBase64: string;
}

export interface LlmRequest {
  system: string;
  userText: string;
  images?: LlmImage[];
  /** Name the provider shows for the structured-output tool or schema. */
  schemaName: string;
  /** JSON Schema of the reply; must pass `findProviderUnsafeParts`. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResult {
  /** Unvalidated reply parsed from the provider; the caller validates it against its own schema. */
  json: unknown;
  usage: LlmUsage;
  latencyMs: number;
  model: string;
  providerKind: ProviderKind;
}

export interface ModelInfo {
  id: string;
}

export interface LlmProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  call(request: LlmRequest): Promise<LlmResult>;
  listModels(): Promise<ModelInfo[]>;
}

/**
 * Why a call failed, in terms the retry policy understands.
 *
 *   AUTH         key rejected or not allowed; retrying the same key cannot help, another provider might.
 *   RATE_LIMIT   too many requests; retry after the provider's delay.
 *   TIMEOUT      the call took too long; retryable.
 *   NETWORK      the provider could not be reached; retryable.
 *   SERVER       provider-side error or overload; retryable.
 *   BAD_REQUEST  the request itself is invalid; every provider would refuse it, so never retried or failed over.
 *   BAD_JSON     the reply was missing or did not match the schema.
 *   REFUSED      the model declined to answer.
 *   BLOCKED      the configured server address is not allowed; this provider cannot be used, another might.
 *   UNSUPPORTED_INPUT  this provider cannot read what was sent (a PDF page for a self-hosted server); another might.
 *   MODEL_UNAVAILABLE  the configured model no longer exists or is not accessible; this provider cannot be used, another might.
 */
export type LlmErrorCode =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER'
  | 'BAD_REQUEST'
  | 'BAD_JSON'
  | 'REFUSED'
  | 'BLOCKED'
  | 'MODEL_UNAVAILABLE'
  | 'UNSUPPORTED_INPUT';

export interface LlmErrorOptions {
  retryable: boolean;
  retryAfterMs?: number;
  status?: number;
}

/**
 * A provider failure. The message never contains the API key or any request content: it is safe to log
 * and to show to an administrator.
 */
export class LlmError extends Error {
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly status?: number;

  constructor(
    readonly code: LlmErrorCode,
    message: string,
    options: LlmErrorOptions,
  ) {
    super(message);
    this.name = 'LlmError';
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
    this.status = options.status;
  }
}
