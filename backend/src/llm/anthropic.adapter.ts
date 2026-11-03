import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type ModelInfo,
} from './llm.types';

const BASE_URL = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_ERROR_MESSAGE = 200;

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  /** Millisecond clock; injectable so latency is testable. */
  now?: () => number;
  timeoutMs?: number;
}

/**
 * Anthropic Messages API through plain `fetch`.
 *
 * Structured output uses a forced tool call whose `input_schema` is the reply schema. The host is fixed,
 * so a key can only ever be sent to Anthropic. Error messages are built from a fixed vocabulary plus a
 * scrubbed, truncated provider message: never the key, never the request content.
 */
export class AnthropicProvider implements LlmProvider {
  readonly kind = 'ANTHROPIC' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private automaticToolChoice = false;

  constructor(options: AnthropicOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async call(request: LlmRequest): Promise<LlmResult> {
    // Providers reject the `$schema` meta keyword inside a tool input schema.
    const inputSchema = { ...request.schema };
    delete inputSchema.$schema;
    const content: unknown[] = (request.images ?? []).map((image) => ({
      type: image.mediaType === 'application/pdf' ? 'document' : 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.dataBase64,
      },
    }));
    content.push({ type: 'text', text: request.userText });

    const startedAt = this.now();
    const post = (automatic: boolean) =>
      this.send('/v1/messages', {
        method: 'POST',
        timeoutMs: request.timeoutMs,
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxOutputTokens,
          system: automatic
            ? request.system +
              String.fromCharCode(10, 10) +
              `Answer only by calling the ${request.schemaName} tool.`
            : request.system,
          tools: [
            {
              name: request.schemaName,
              description: 'Return the structured result',
              input_schema: inputSchema,
            },
          ],
          tool_choice: automatic
            ? { type: 'auto' }
            : { type: 'tool', name: request.schemaName },
          messages: [{ role: 'user', content }],
        }),
      });
    let response: Response;
    // Another call may discover the refusal while this one is in flight, so remember what THIS call sent.
    const sentAutomatic = this.automaticToolChoice;
    try {
      response = await post(sentAutomatic);
    } catch (error) {
      // Some models (those that think before answering) refuse a forced tool call. Ask them to use the tool instead,
      // and remember it: the model of a provider never changes.
      if (sentAutomatic || !refusesForcedTool(error)) throw error;
      this.automaticToolChoice = true;
      response = await post(true);
    }
    const latencyMs = this.now() - startedAt;

    const body = (await response
      .json()
      .catch(() => null)) as AnthropicReply | null;
    if (body?.stop_reason === 'refusal') {
      throw new LlmError('REFUSED', 'the model declined to answer', {
        retryable: false,
      });
    }
    // A tool input cut off by the output limit is still valid JSON, just missing its later keys; never hand it on as a
    // complete result.
    if (body?.stop_reason === 'max_tokens') {
      throw new LlmError(
        'BAD_JSON',
        'the reply was cut off by the output limit',
        { retryable: false },
      );
    }
    const toolUse = body?.content?.find((block) => block.type === 'tool_use');
    if (!toolUse || toolUse.input === undefined) {
      throw new LlmError(
        'BAD_JSON',
        'the reply contained no structured result',
        { retryable: true },
      );
    }
    return {
      json: toolUse.input,
      usage: {
        inputTokens: body?.usage?.input_tokens ?? 0,
        outputTokens: body?.usage?.output_tokens ?? 0,
      },
      latencyMs,
      model: this.model,
      providerKind: this.kind,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.send('/v1/models?limit=100', { method: 'GET' });
    const body = (await response.json().catch(() => null)) as {
      data?: Array<{ id?: string }>;
    } | null;
    return (body?.data ?? [])
      .map((entry) => entry.id)
      .filter(
        (id): id is string =>
          typeof id === 'string' && id.startsWith('claude-'),
      )
      .map((id) => ({ id }));
  }

  private async send(
    path: string,
    init: { method: string; body?: string; timeoutMs?: number },
  ): Promise<Response> {
    const { timeoutMs, ...fetchInit } = init;
    let response: Response;
    try {
      response = await this.fetchImpl(`${BASE_URL}${path}`, {
        ...fetchInit,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': API_VERSION,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      throw this.networkError(error);
    }
    if (!response.ok) throw await this.httpError(response);
    return response;
  }

  private networkError(error: unknown): LlmError {
    // Read `name` structurally: a DOMException is not an `Error` instance in every runtime realm.
    const name = (error as { name?: unknown } | null)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      return new LlmError('TIMEOUT', 'the call timed out', { retryable: true });
    }
    return new LlmError('NETWORK', 'the provider could not be reached', {
      retryable: true,
    });
  }

  private async httpError(response: Response): Promise<LlmError> {
    const status = response.status;
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const detail = this.scrub(body?.error?.message);
    const suffix = detail ? `: ${detail}` : '';
    if (status === 401 || status === 403) {
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
        { retryable: true, status },
      );
    }
    return new LlmError(
      'BAD_REQUEST',
      `request refused (HTTP ${status})${suffix}`,
      { retryable: false, status },
    );
  }

  /** Removes the key and anything key-shaped from a provider message, then truncates it. */
  private scrub(message: string | undefined): string {
    if (!message) return '';
    return message
      .split(this.apiKey)
      .join('[key]')
      .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[key]')
      .replace(/\d{9,}/g, '[digits]')
      .slice(0, MAX_ERROR_MESSAGE);
  }
}

interface AnthropicReply {
  content?: Array<{ type: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

/** The 400 a model gives when it does not accept `tool_choice: tool`. */
function refusesForcedTool(error: unknown): boolean {
  return (
    error instanceof LlmError &&
    error.code === 'BAD_REQUEST' &&
    /tool_choice/i.test(error.message)
  );
}
