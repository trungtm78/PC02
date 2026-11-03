import { GeminiProvider } from './gemini.adapter';
import { LlmError, type LlmRequest } from './llm.types';

const KEY = 'AIzaSyTESTKEY-0123456789abcdefghijklmnop';

const baseRequest: LlmRequest = {
  system: 'You analyse paperwork.',
  userText: 'Transcribe.',
  images: [{ mediaType: 'image/jpeg', dataBase64: 'AAAA' }],
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

function fakeFetch(responder: (call: FetchCall) => Response) {
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
  candidates: [
    {
      content: { parts: [{ text: '{"ok":true}' }] },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: { promptTokenCount: 21, candidatesTokenCount: 4 },
};

const provider = (fetchImpl: typeof fetch, clock = () => 0) =>
  new GeminiProvider({
    apiKey: KEY,
    model: 'gemini-2.5-flash',
    fetchImpl,
    now: clock,
  });

async function failure(promise: Promise<unknown>): Promise<LlmError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LlmError) return error;
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('GeminiProvider.call', () => {
  it('sends the key in a header (never in the URL), the images before the text, and the schema as the reply schema', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await provider(fetchImpl).call(baseRequest);

    const [call] = calls;
    expect(call.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    );
    expect(call.url).not.toContain(KEY);
    expect(
      (call.init.headers as Record<string, string>)['x-goog-api-key'],
    ).toBe(KEY);

    const body = JSON.parse(call.init.body as string) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
      generationConfig: {
        responseMimeType: string;
        responseJsonSchema: Record<string, unknown>;
        maxOutputTokens: number;
      };
    };
    expect(body.systemInstruction.parts[0].text).toBe('You analyse paperwork.');
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'AAAA' },
    });
    expect(body.contents[0].parts[1]).toEqual({ text: 'Transcribe.' });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    // the request's 500 plus headroom for the thinking tokens Gemini counts against the limit
    expect(body.generationConfig.maxOutputTokens).toBe(500 + 8192);
    // `$schema` is a meta keyword the API refuses.
    expect(body.generationConfig.responseJsonSchema).not.toHaveProperty(
      '$schema',
    );
    expect(body.generationConfig.responseJsonSchema).toMatchObject({
      type: 'object',
    });
  });

  it('returns the parsed JSON, the token counts and the latency', async () => {
    const times = [1000, 1250];
    const { fetchImpl } = fakeFetch(() => json(200, okBody));
    const result = await provider(fetchImpl, () => times.shift() ?? 0).call(
      baseRequest,
    );
    expect(result).toEqual({
      json: { ok: true },
      usage: { inputTokens: 21, outputTokens: 4 },
      latencyMs: 250,
      model: 'gemini-2.5-flash',
      providerKind: 'GEMINI',
    });
  });

  it('counts the thinking tokens as output: they are billed like output', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(200, {
        ...okBody,
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 1000,
        },
      }),
    );
    const result = await provider(fetchImpl).call(baseRequest);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 1020 });
  });

  it('refuses to follow a redirect: the key travels in a header and the body holds the scan', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await provider(fetchImpl).call(baseRequest);
    expect(calls[0].init.redirect).toBe('error');
  });

  it('a model that no longer exists lets the next provider try instead of stopping the chain', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(404, { error: { message: 'models/x is not found' } }),
    );
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect([error.code, error.retryable]).toEqual(['MODEL_UNAVAILABLE', false]);
  });

  it('treats a reply that is not JSON as retryable bad output', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(200, {
        candidates: [{ content: { parts: [{ text: 'not json at all' }] } }],
      }),
    );
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect(error.code).toBe('BAD_JSON');
    expect(error.retryable).toBe(true);
  });

  it('treats a reply cut off by the length limit as bad output, not as a result', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(200, {
        candidates: [
          {
            content: { parts: [{ text: '{"ok":' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      }),
    );
    expect((await failure(provider(fetchImpl).call(baseRequest))).code).toBe(
      'BAD_JSON',
    );
  });

  it('reports a safety block as a refusal that is not retried', async () => {
    const blocked = fakeFetch(() =>
      json(200, { promptFeedback: { blockReason: 'SAFETY' } }),
    );
    const a = await failure(provider(blocked.fetchImpl).call(baseRequest));
    expect(a.code).toBe('REFUSED');
    expect(a.retryable).toBe(false);

    const stopped = fakeFetch(() =>
      json(200, { candidates: [{ finishReason: 'SAFETY' }] }),
    );
    expect(
      (await failure(provider(stopped.fetchImpl).call(baseRequest))).code,
    ).toBe('REFUSED');
  });

  it('maps HTTP failures: bad key (also the 400 Google sends for it), rate limit with Retry-After, server errors, bad request', async () => {
    const run = async (
      status: number,
      body: unknown,
      headers: Record<string, string> = {},
    ) =>
      failure(
        provider(fakeFetch(() => json(status, body, headers)).fetchImpl).call(
          baseRequest,
        ),
      );

    for (const status of [401, 403]) {
      const e = await run(status, { error: { message: 'denied' } });
      expect([e.code, e.retryable]).toEqual(['AUTH', false]);
    }
    const invalidKey = await run(400, {
      error: {
        status: 'INVALID_ARGUMENT',
        message: 'API key not valid. Please pass a valid API key.',
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    });
    expect(invalidKey.code).toBe('AUTH');

    const limited = await run(
      429,
      { error: { message: 'quota' } },
      { 'retry-after': '3' },
    );
    expect([limited.code, limited.retryable, limited.retryAfterMs]).toEqual([
      'RATE_LIMIT',
      true,
      3000,
    ]);
    for (const status of [500, 503, 408]) {
      const e = await run(status, { error: { message: 'down' } });
      expect([e.code, e.retryable]).toEqual(['SERVER', true]);
    }
    const bad = await run(400, { error: { message: 'schema not supported' } });
    expect([bad.code, bad.retryable]).toEqual(['BAD_REQUEST', false]);
  });

  it('never lets the key or long numbers reach an error message', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(400, {
        error: {
          message: `bad ${KEY} and AIzaSyOTHERKEY0123456789abcdefghijklmnopq id 0790123456789`,
        },
      }),
    );
    const error = await failure(provider(fetchImpl).call(baseRequest));
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain('AIzaSy');
    expect(error.message).not.toMatch(/\d{9,}/);
  });

  it('reports a timeout and a network failure as retryable', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    const slow = fakeFetch(() => {
      throw timeout;
    });
    expect(
      (await failure(provider(slow.fetchImpl).call(baseRequest))).code,
    ).toBe('TIMEOUT');
    const down = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    expect(
      (await failure(provider(down.fetchImpl).call(baseRequest))).code,
    ).toBe('NETWORK');
  });
});

describe('GeminiProvider.listModels', () => {
  it('lists only models that can generate content, without the "models/" prefix', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json(200, {
        models: [
          {
            name: 'models/gemini-2.5-flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            supportedGenerationMethods: ['embedContent'],
          },
          {
            name: 'models/gemini-2.5-pro',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
        ],
      }),
    );
    const models = await provider(fetchImpl).listModels();
    expect(models.map((m) => m.id)).toEqual([
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ]);
    expect(calls[0].url).toContain('/v1beta/models');
    expect(calls[0].url).not.toContain(KEY);
  });
});
