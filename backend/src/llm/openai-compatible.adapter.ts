import { createPinnedFetch } from './pinned-fetch';
import { assertSafeBaseUrl, type Lookup } from './ssrf-guard';
import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type ModelInfo,
} from './llm.types';
import { refusesOutputLength } from './output-limit';

const OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_ERROR_MESSAGE = 200;

export interface OpenAiCompatibleOptions {
  /** OPENAI is the cloud service at its fixed host; SELF_HOSTED is the unit's own server at `baseUrl`. */
  kind: 'OPENAI' | 'SELF_HOSTED';
  apiKey: string;
  model: string;
  /** Required for SELF_HOSTED, ignored for OPENAI. */
  baseUrl?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  /** DNS lookup used for the address check of a self-hosted server; injectable for tests. */
  lookup?: Lookup;
}

/**
 * Any server that speaks the OpenAI chat-completions protocol: OpenAI itself, or a model server run by the unit
 * (vLLM, Ollama, llama.cpp, LM Studio...). Structured output uses a strict `json_schema` response format.
 *
 * Cloud OpenAI has its host fixed in code, so a key can only go to OpenAI. A self-hosted URL is checked right before
 * every call (see `assertSafeBaseUrl`), and redirects are refused.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly kind: 'OPENAI' | 'SELF_HOSTED';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeoutMs: number;
  private readonly lookup?: Lookup;

  constructor(options: OpenAiCompatibleOptions) {
    this.kind = options.kind;
    this.model = options.model;
    this.apiKey = options.apiKey;
    if (options.kind === 'SELF_HOSTED') {
      if (!options.baseUrl) {
        throw new Error('a self-hosted provider needs a base URL');
      }
      this.baseUrl = normalise(options.baseUrl);
    } else {
      this.baseUrl = OPENAI_BASE_URL;
    }
    // A self-hosted server is reached through a client that checks the address as the socket connects.
    this.fetchImpl =
      options.fetchImpl ??
      (options.kind === 'SELF_HOSTED'
        ? createPinnedFetch(options.lookup)
        : fetch);
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.lookup = options.lookup;
  }

  async call(request: LlmRequest): Promise<LlmResult> {
    const schema = { ...request.schema };
    delete schema.$schema;
    if (
      this.kind === 'SELF_HOSTED' &&
      request.images?.some((i) => i.mediaType === 'application/pdf')
    ) {
      // Self-hosted servers take images only; rasterising a PDF is not done here. Say so, so the next provider is tried.
      throw new LlmError(
        'UNSUPPORTED_INPUT',
        'a self-hosted server cannot read a PDF page',
        { retryable: false },
      );
    }
    const content: unknown[] = (request.images ?? []).map((image) =>
      image.mediaType === 'application/pdf'
        ? {
            type: 'file',
            file: {
              filename: 'page.pdf',
              file_data: `data:application/pdf;base64,${image.dataBase64}`,
            },
          }
        : {
            type: 'image_url',
            image_url: {
              url: `data:${image.mediaType};base64,${image.dataBase64}`,
            },
          },
    );
    content.push({ type: 'text', text: request.userText });

    // Cloud OpenAI's newer models refuse `max_tokens`; self-hosted servers only know the older name.
    const limit =
      this.kind === 'OPENAI'
        ? { max_completion_tokens: request.maxOutputTokens }
        : { max_tokens: request.maxOutputTokens };

    const startedAt = this.now();
    const response = await this.send('/v1/chat/completions', {
      method: 'POST',
      timeoutMs: request.timeoutMs,
      body: JSON.stringify({
        model: this.model,
        ...limit,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.schemaName, strict: true, schema },
        },
      }),
    });
    const latencyMs = this.now() - startedAt;

    const body = (await response.json().catch(() => null)) as ChatReply | null;
    const choice = body?.choices?.[0];
    if (choice?.message?.refusal) {
      throw new LlmError('REFUSED', 'the model declined to answer', {
        retryable: false,
      });
    }
    const text = choice?.message?.content;
    if (!text || choice?.finish_reason === 'length') {
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
        inputTokens: body?.usage?.prompt_tokens ?? 0,
        outputTokens: body?.usage?.completion_tokens ?? 0,
      },
      latencyMs,
      model: this.model,
      providerKind: this.kind,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.send('/v1/models', { method: 'GET' });
    const body = (await response.json().catch(() => null)) as {
      data?: Array<{ id?: string }>;
    } | null;
    return (body?.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string')
      .sort()
      .map((id) => ({ id }));
  }

  private async send(
    path: string,
    init: { method: string; body?: string; timeoutMs?: number },
  ): Promise<Response> {
    const { timeoutMs, ...fetchInit } = init;
    if (this.kind === 'SELF_HOSTED') {
      await assertSafeBaseUrl(this.baseUrl, this.lookup);
    }
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...fetchInit,
        headers,
        // An allowed host must not be able to send the call (and the key) on to a blocked one.
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
      });
    } catch (error) {
      // The connect-time address check reports itself (BLOCKED); it is not a network failure to retry.
      if (error instanceof LlmError) throw error;
      const name = (error as { name?: unknown } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new LlmError('TIMEOUT', 'the call timed out', {
          retryable: true,
        });
      }
      throw new LlmError('NETWORK', 'the provider could not be reached', {
        retryable: true,
      });
    }
    if (!response.ok) throw await this.httpError(response);
    return response;
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
        {
          retryable: false,
          status,
        },
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
    if (status === 400 && refusesOutputLength(detail)) {
      return new LlmError(
        'OUTPUT_LIMIT',
        `the model cannot return an answer this long (HTTP 400)${suffix}`,
        { retryable: false, status },
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
    const withoutKey = this.apiKey
      ? message.split(this.apiKey).join('[key]')
      : message;
    return withoutKey
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[key]')
      .replace(/\d{9,}/g, '[digits]')
      .slice(0, MAX_ERROR_MESSAGE);
  }
}

/** Trims a trailing slash and a trailing `/v1`, so paths are always added as `/v1/...` exactly once. */
function normalise(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

interface ChatReply {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
