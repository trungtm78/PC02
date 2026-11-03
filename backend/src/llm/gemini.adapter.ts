import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type ModelInfo,
} from './llm.types';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ERROR_MESSAGE = 200;
/**
 * Gemini's thinking tokens count against `maxOutputTokens`. Without headroom a long transcript is cut off after the
 * model has spent its budget thinking, and the reply is incomplete JSON.
 */
const THINKING_HEADROOM_TOKENS = 8192;

export interface GeminiOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}

/**
 * Google Gemini (`generateContent`) through plain `fetch`.
 *
 * The reply is forced into JSON that matches the request schema (`responseMimeType` + `responseJsonSchema`). The
 * host is fixed and the key travels in a header, never in the URL, so it cannot end up in a log line or a redirect.
 */
export class GeminiProvider implements LlmProvider {
  readonly kind = 'GEMINI' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;

  constructor(options: GeminiOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async call(request: LlmRequest): Promise<LlmResult> {
    const schema = { ...request.schema };
    delete schema.$schema;
    const parts: unknown[] = (request.images ?? []).map((image) => ({
      inlineData: { mimeType: image.mediaType, data: image.dataBase64 },
    }));
    parts.push({ text: request.userText });

    const startedAt = this.now();
    const response = await this.send(
      `/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            maxOutputTokens: request.maxOutputTokens + THINKING_HEADROOM_TOKENS,
          },
        }),
      },
    );
    const latencyMs = this.now() - startedAt;

    const body = (await response
      .json()
      .catch(() => null)) as GeminiReply | null;
    const candidate = body?.candidates?.[0];
    if (
      body?.promptFeedback?.blockReason ||
      candidate?.finishReason === 'SAFETY'
    ) {
      throw new LlmError('REFUSED', 'the model declined to answer', {
        retryable: false,
      });
    }
    const text = candidate?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');
    // A reply cut off by the length limit is incomplete JSON: bad output, not a result.
    if (!text || candidate?.finishReason === 'MAX_TOKENS') {
      throw new LlmError(
        'BAD_JSON',
        'the reply contained no complete structured result',
        {
          retryable: true,
        },
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new LlmError('BAD_JSON', 'the reply was not valid JSON', {
        retryable: true,
      });
    }
    return {
      json: parsed,
      usage: {
        inputTokens: body?.usageMetadata?.promptTokenCount ?? 0,
        // Thinking tokens are billed like output tokens, so they count as output.
        outputTokens:
          (body?.usageMetadata?.candidatesTokenCount ?? 0) +
          (body?.usageMetadata?.thoughtsTokenCount ?? 0),
      },
      latencyMs,
      model: this.model,
      providerKind: this.kind,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.send('/models?pageSize=200', { method: 'GET' });
    const body = (await response.json().catch(() => null)) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    } | null;
    return (body?.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name)
      .filter((name): name is string => typeof name === 'string')
      .map((name) => ({ id: name.replace(/^models\//, '') }));
  }

  private async send(
    path: string,
    init: { method: string; body?: string },
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          'x-goog-api-key': this.apiKey,
          'content-type': 'application/json',
        },
        // The key is in a header and the body holds the scan: a redirect must not carry either elsewhere.
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const name = (error as { name?: unknown } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        return Promise.reject(
          new LlmError('TIMEOUT', 'the call timed out', { retryable: true }),
        );
      }
      return Promise.reject(
        new LlmError('NETWORK', 'the provider could not be reached', {
          retryable: true,
        }),
      );
    }
    if (!response.ok) throw await this.httpError(response);
    return response;
  }

  private async httpError(response: Response): Promise<LlmError> {
    const status = response.status;
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; details?: Array<{ reason?: string }> };
    } | null;
    const detail = this.scrub(body?.error?.message);
    const suffix = detail ? `: ${detail}` : '';
    // Google answers a wrong key with HTTP 400 and the reason API_KEY_INVALID, not with 401.
    const keyRejected =
      status === 401 ||
      status === 403 ||
      body?.error?.details?.some((d) => d.reason === 'API_KEY_INVALID') ===
        true;
    if (keyRejected) {
      return new LlmError(
        'AUTH',
        `the key was rejected (HTTP ${status})${suffix}`,
        { retryable: false, status },
      );
    }
    if (status === 404) {
      return new LlmError(
        'MODEL_UNAVAILABLE',
        `the model is not available (HTTP 404)${suffix}`,
        {
          retryable: false,
          status,
        },
      );
    }
    if (status === 429) {
      const seconds = Number(response.headers.get('retry-after'));
      return new LlmError('RATE_LIMIT', `rate limited (HTTP 429)${suffix}`, {
        retryable: true,
        status,
        ...(Number.isFinite(seconds) && seconds > 0
          ? { retryAfterMs: seconds * 1000 }
          : {}),
      });
    }
    if (status >= 500 || status === 408) {
      return new LlmError(
        'SERVER',
        `provider error (HTTP ${status})${suffix}`,
        {
          retryable: true,
          status,
        },
      );
    }
    return new LlmError(
      'BAD_REQUEST',
      `request refused (HTTP ${status})${suffix}`,
      {
        retryable: false,
        status,
      },
    );
  }

  /** Removes the key and anything key-shaped from a provider message, then truncates it. */
  private scrub(message: string | undefined): string {
    if (!message) return '';
    return message
      .split(this.apiKey)
      .join('[key]')
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]')
      .replace(/\d{9,}/g, '[digits]')
      .slice(0, MAX_ERROR_MESSAGE);
  }
}

interface GeminiReply {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}
