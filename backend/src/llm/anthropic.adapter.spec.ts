import { AnthropicProvider } from './anthropic.adapter';
import { LlmError, type LlmRequest } from './llm.types';

const KEY = 'sk-ant-test-SECRET-0123456789';

const baseRequest: LlmRequest = {
  system: 'You analyse paperwork.',
  userText: 'Transcribe.',
  images: [{ mediaType: 'image/png', dataBase64: 'AAAA' }],
  schemaName: 'submit_evidence',
  schema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
  maxOutputTokens: 500,
};

interface FetchCall {
  url: string;
  init: RequestInit;
}

interface SentBody {
  model: string;
  max_tokens: number;
  system: string;
  tool_choice: { type: string; name: string };
  tools: Array<{ name: string; input_schema: Record<string, unknown> }>;
  messages: Array<{ content: unknown[] }>;
}

function fakeFetch(responder: (call: FetchCall) => Response): {
  fetchImpl: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    try {
      return Promise.resolve(responder(call));
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const json = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const okBody = {
  content: [{ type: 'tool_use', name: 'submit_evidence', input: { ok: true } }],
  usage: { input_tokens: 11, output_tokens: 7 },
  stop_reason: 'tool_use',
};

function provider(fetchImpl: typeof fetch, clock = () => 0) {
  return new AnthropicProvider({
    apiKey: KEY,
    model: 'claude-haiku-5-5',
    fetchImpl,
    now: clock,
  });
}

/** Awaits a promise that must reject with an LlmError and returns it, typed. */
async function failure(promise: Promise<unknown>): Promise<LlmError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LlmError) return error;
    throw error;
  }
  throw new Error('expected the call to reject');
}

describe('AnthropicProvider.call', () => {
  it('sends a forced tool call with the image, the key header and a schema without $schema', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await provider(fetchImpl).call(baseRequest);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(KEY);
    expect(headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse(calls[0].init.body as string) as SentBody;
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.max_tokens).toBe(500);
    expect(body.system).toBe('You analyse paperwork.');
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'submit_evidence' });
    expect(body.tools[0].name).toBe('submit_evidence');
    expect(body.tools[0].input_schema.$schema).toBeUndefined();
    expect(body.tools[0].input_schema.type).toBe('object');
    const content = body.messages[0].content;
    expect(content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
    });
    expect(content[content.length - 1]).toEqual({
      type: 'text',
      text: 'Transcribe.',
    });
  });

  it('returns the tool input, token usage and latency', async () => {
    let t = 1000;
    const { fetchImpl } = fakeFetch(() => {
      t += 250;
      return json(200, okBody);
    });
    const result = await provider(fetchImpl, () => t).call(baseRequest);
    expect(result.json).toEqual({ ok: true });
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
    expect(result.latencyMs).toBe(250);
    expect(result.model).toBe('claude-haiku-5-5');
    expect(result.providerKind).toBe('ANTHROPIC');
  });

  const failures: Array<[string, () => Response, string, boolean]> = [
    [
      '401 is an authentication error and is not retried',
      () => json(401, { error: { message: 'bad key' } }),
      'AUTH',
      false,
    ],
    [
      '403 is an authentication error',
      () => json(403, { error: { message: 'forbidden' } }),
      'AUTH',
      false,
    ],
    [
      '400 is a bad request and is not retried',
      () => json(400, { error: { message: 'schema invalid' } }),
      'BAD_REQUEST',
      false,
    ],
    [
      '500 is a retryable server error',
      () => json(500, { error: { message: 'oops' } }),
      'SERVER',
      true,
    ],
    [
      '529 (overloaded) is a retryable server error',
      () => json(529, { error: { message: 'overloaded' } }),
      'SERVER',
      true,
    ],
  ];
  it.each(failures)('%s', async (_name, response, code, retryable) => {
    const { fetchImpl } = fakeFetch(response);
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
  });

  it('429 is retryable and carries the Retry-After delay in milliseconds', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(429, { error: { message: 'slow down' } }, { 'retry-after': '7' }),
    );
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect(error.code).toBe('RATE_LIMIT');
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(7000);
  });

  it('a network failure is retryable and an abort is a timeout', async () => {
    const net = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const netError = await failure(provider(net.fetchImpl).call(baseRequest));
    expect(netError.code).toBe('NETWORK');
    expect(netError.retryable).toBe(true);

    const timeout = fakeFetch(() => {
      // What fetch rejects with when AbortSignal.timeout fires; built as a plain Error because the
      // jest node environment does not expose DOMException.
      throw Object.assign(new Error('signal timed out'), {
        name: 'TimeoutError',
      });
    });
    const timeoutError = await failure(
      provider(timeout.fetchImpl).call(baseRequest),
    );
    expect(timeoutError.code).toBe('TIMEOUT');
    expect(timeoutError.retryable).toBe(true);
  });

  it('a refusal is not retried and a reply with no tool call is bad JSON', async () => {
    const refusal = fakeFetch(() =>
      json(200, {
        content: [],
        usage: { input_tokens: 1, output_tokens: 0 },
        stop_reason: 'refusal',
      }),
    );
    const refusalError = await failure(
      provider(refusal.fetchImpl).call(baseRequest),
    );
    expect(refusalError.code).toBe('REFUSED');
    expect(refusalError.retryable).toBe(false);

    const noTool = fakeFetch(() =>
      json(200, {
        content: [{ type: 'text', text: 'hi' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      }),
    );
    const noToolError = await failure(
      provider(noTool.fetchImpl).call(baseRequest),
    );
    expect(noToolError.code).toBe('BAD_JSON');
  });

  it('never puts the API key or the request content into an error message', async () => {
    const { fetchImpl } = fakeFetch(() => {
      throw new TypeError(`fetch failed for key ${KEY}`);
    });
    const error = await failure(
      provider(fetchImpl).call({
        ...baseRequest,
        userText: 'PRIVATE CCCD 079190012345',
      }),
    );
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain('079190012345');

    const bad = fakeFetch(() =>
      json(400, { error: { message: `rejected ${KEY} 079190012345` } }),
    );
    const badError = await failure(provider(bad.fetchImpl).call(baseRequest));
    expect(badError.message).not.toContain(KEY);
    expect(badError.message).not.toContain('079190012345');
  });
});

describe('AnthropicProvider PDF pages', () => {
  it('sends a PDF page as a document block, not as an image', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await provider(fetchImpl).call({
      ...baseRequest,
      images: [{ mediaType: 'application/pdf', dataBase64: 'JVBER' }],
    });
    const body = JSON.parse(calls[0].init.body as string) as SentBody;
    expect(body.messages[0].content[0]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'JVBER' },
    });
  });
});

describe('AnthropicProvider unknown model', () => {
  it('a model that no longer exists lets the next provider try instead of stopping the chain', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(404, { error: { type: 'not_found_error', message: 'model: x' } }),
    );
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect([error.code, error.retryable]).toEqual(['MODEL_UNAVAILABLE', false]);
  });
});

describe('AnthropicProvider.listModels', () => {
  it('lists Claude model ids and sends the key', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json(200, {
        data: [
          { id: 'claude-haiku-5-5' },
          { id: 'claude-sonnet-5-5' },
          { id: 'other-thing' },
        ],
      }),
    );
    const models = await provider(fetchImpl).listModels();
    expect(models.map((m) => m.id)).toEqual([
      'claude-haiku-5-5',
      'claude-sonnet-5-5',
    ]);
    expect(calls[0].url).toContain('/v1/models');
    expect((calls[0].init.headers as Record<string, string>)['x-api-key']).toBe(
      KEY,
    );
  });

  it('classifies a rejected key as AUTH', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(401, { error: { message: 'invalid x-api-key' } }),
    );
    const error = await failure(provider(fetchImpl).listModels());
    expect(error.code).toBe('AUTH');
  });
});
