import { OpenAiCompatibleProvider } from './openai-compatible.adapter';
import { LlmError, type LlmRequest } from './llm.types';

const KEY = 'sk-proj-TESTKEY-0123456789abcdefghijkl';

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
  choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 30, completion_tokens: 5 },
};

const publicLookup = () =>
  Promise.resolve([{ address: '10.0.0.7', family: 4 }]);

const cloud = (fetchImpl: typeof fetch, clock = () => 0) =>
  new OpenAiCompatibleProvider({
    kind: 'OPENAI',
    apiKey: KEY,
    model: 'gpt-5-mini',
    fetchImpl,
    now: clock,
  });

const selfHosted = (
  fetchImpl: typeof fetch,
  baseUrl = 'http://llm.noi-bo.local:8000',
  lookup = publicLookup,
) =>
  new OpenAiCompatibleProvider({
    kind: 'SELF_HOSTED',
    apiKey: KEY,
    model: 'qwen2.5-vl',
    baseUrl,
    fetchImpl,
    lookup,
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

describe('OpenAiCompatibleProvider.call', () => {
  it('cloud OpenAI: fixed host, bearer key, system + user messages with the image as a data URL, strict JSON schema', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await cloud(fetchImpl).call(baseRequest);

    const [call] = calls;
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect((call.init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${KEY}`,
    );
    expect(call.init.redirect).toBe('error');

    const body = JSON.parse(call.init.body as string) as {
      model: string;
      max_completion_tokens: number;
      max_tokens?: number;
      messages: Array<{ role: string; content: unknown }>;
      response_format: {
        type: string;
        json_schema: {
          name: string;
          strict: boolean;
          schema: Record<string, unknown>;
        };
      };
    };
    expect(body.model).toBe('gpt-5-mini');
    expect(body.max_completion_tokens).toBe(500);
    expect(body.max_tokens).toBeUndefined();
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'You analyse paperwork.',
    });
    expect(body.messages[1].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'text', text: 'Transcribe.' },
    ]);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema).toMatchObject({
      name: 'submit_evidence',
      strict: true,
    });
    expect(body.response_format.json_schema.schema).not.toHaveProperty(
      '$schema',
    );
  });

  it("self-hosted: calls the unit's own server, with the older token parameter", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await selfHosted(fetchImpl).call(baseRequest);
    expect(calls[0].url).toBe(
      'http://llm.noi-bo.local:8000/v1/chat/completions',
    );
    const body = JSON.parse(calls[0].init.body as string) as Record<
      string,
      unknown
    >;
    expect(body.max_tokens).toBe(500);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  it('does not double the /v1 when the base URL already ends with it, nor a trailing slash', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    await selfHosted(fetchImpl, 'http://llm.noi-bo.local:8000/v1/').call(
      baseRequest,
    );
    expect(calls[0].url).toBe(
      'http://llm.noi-bo.local:8000/v1/chat/completions',
    );
  });

  it('sends no Authorization header when the self-hosted server has no key', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    const provider = new OpenAiCompatibleProvider({
      kind: 'SELF_HOSTED',
      apiKey: '',
      model: 'm',
      baseUrl: 'http://10.0.0.7:8000',
      fetchImpl,
    });
    await provider.call(baseRequest);
    expect(calls[0].init.headers as Record<string, string>).not.toHaveProperty(
      'authorization',
    );
  });

  it('returns the parsed JSON, token counts, latency and the kind that served it', async () => {
    const times = [10, 90];
    const { fetchImpl } = fakeFetch(() => json(200, okBody));
    const result = await cloud(fetchImpl, () => times.shift() ?? 0).call(
      baseRequest,
    );
    expect(result).toEqual({
      json: { ok: true },
      usage: { inputTokens: 30, outputTokens: 5 },
      latencyMs: 80,
      model: 'gpt-5-mini',
      providerKind: 'OPENAI',
    });
    const { fetchImpl: f2 } = fakeFetch(() => json(200, okBody));
    expect((await selfHosted(f2).call(baseRequest)).providerKind).toBe(
      'SELF_HOSTED',
    );
  });

  it('refusals and cut-off or invalid output are not results', async () => {
    const refused = fakeFetch(() =>
      json(200, {
        choices: [
          {
            message: { content: null, refusal: 'I cannot help' },
            finish_reason: 'stop',
          },
        ],
      }),
    );
    const r = await failure(cloud(refused.fetchImpl).call(baseRequest));
    expect([r.code, r.retryable]).toEqual(['REFUSED', false]);

    const cut = fakeFetch(() =>
      json(200, {
        choices: [{ message: { content: '{"ok":' }, finish_reason: 'length' }],
      }),
    );
    expect((await failure(cloud(cut.fetchImpl).call(baseRequest))).code).toBe(
      'BAD_JSON',
    );

    const garbage = fakeFetch(() =>
      json(200, {
        choices: [{ message: { content: 'nope' }, finish_reason: 'stop' }],
      }),
    );
    const g = await failure(cloud(garbage.fetchImpl).call(baseRequest));
    expect([g.code, g.retryable]).toEqual(['BAD_JSON', true]);
  });

  it('maps HTTP failures like the other providers', async () => {
    const run = (status: number, headers: Record<string, string> = {}) =>
      failure(
        cloud(
          fakeFetch(() => json(status, { error: { message: 'x' } }, headers))
            .fetchImpl,
        ).call(baseRequest),
      );
    for (const status of [401, 403])
      expect((await run(status)).code).toBe('AUTH');
    const limited = await run(429, { 'retry-after': '2' });
    expect([limited.code, limited.retryAfterMs]).toEqual(['RATE_LIMIT', 2000]);
    for (const status of [500, 502, 408])
      expect((await run(status)).code).toBe('SERVER');
    expect((await run(400)).code).toBe('BAD_REQUEST');
  });

  it('a model that no longer exists lets the next provider try instead of stopping the chain', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(404, {
        error: { message: 'The model does not exist', code: 'model_not_found' },
      }),
    );
    const error = await failure(cloud(fetchImpl).call(baseRequest));
    expect([error.code, error.retryable]).toEqual(['MODEL_UNAVAILABLE', false]);
  });

  it('never lets the key or key-shaped text into an error message', async () => {
    const { fetchImpl } = fakeFetch(() =>
      json(401, {
        error: {
          message: `Incorrect API key provided: ${KEY}. also sk-proj-OTHER-0123456789abcdef`,
        },
      }),
    );
    const error = await failure(cloud(fetchImpl).call(baseRequest));
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain('sk-proj');
  });

  it('timeouts and network failures are retryable', async () => {
    const slow = fakeFetch(() => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    });
    expect((await failure(cloud(slow.fetchImpl).call(baseRequest))).code).toBe(
      'TIMEOUT',
    );
    const down = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    expect((await failure(cloud(down.fetchImpl).call(baseRequest))).code).toBe(
      'NETWORK',
    );
  });

  it('a blocked address found while connecting stays BLOCKED, not a retryable network error', async () => {
    const fetchBlocked = (() => Promise.reject(new LlmError('BLOCKED', 'x', { retryable: false }))) as unknown as typeof fetch;
    const error = await failure(selfHosted(fetchBlocked).call(baseRequest));
    expect([error.code, error.retryable]).toEqual(['BLOCKED', false]);
  });

  it('a redirect is a failure: an allowed host must not bounce the call to a blocked one', async () => {
    const redirect = fakeFetch(() => {
      throw new TypeError('redirect mode is set to error');
    });
    expect(
      (await failure(selfHosted(redirect.fetchImpl).call(baseRequest))).code,
    ).toBe('NETWORK');
  });
});

describe('self-hosted address checks', () => {
  it('refuses a server whose name now resolves to the metadata address, without sending anything', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, okBody));
    const lookup = () =>
      Promise.resolve([{ address: '169.254.169.254', family: 4 }]);
    const error = await failure(
      selfHosted(fetchImpl, 'http://llm.noi-bo.local:8000', lookup).call(
        baseRequest,
      ),
    );
    expect(error.code).toBe('BLOCKED');
    expect(calls).toHaveLength(0);
  });

  it('does the same check before listing models', async () => {
    const { fetchImpl, calls } = fakeFetch(() => json(200, { data: [] }));
    const lookup = () =>
      Promise.resolve([{ address: '169.254.169.254', family: 4 }]);
    const error = await failure(
      selfHosted(fetchImpl, 'http://x.example', lookup).listModels(),
    );
    expect(error.code).toBe('BLOCKED');
    expect(calls).toHaveLength(0);
  });

  it('cloud OpenAI is not looked up at all: its host is fixed in the code', async () => {
    const lookup = jest.fn(publicLookup);
    const { fetchImpl } = fakeFetch(() => json(200, okBody));
    await new OpenAiCompatibleProvider({
      kind: 'OPENAI',
      apiKey: KEY,
      model: 'gpt-5-mini',
      fetchImpl,
      lookup,
    }).call(baseRequest);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('a self-hosted provider without a base URL cannot be built', () => {
    expect(
      () =>
        new OpenAiCompatibleProvider({
          kind: 'SELF_HOSTED',
          apiKey: '',
          model: 'm',
        }),
    ).toThrow('base URL');
  });
});

describe('OpenAiCompatibleProvider.listModels', () => {
  it('lists the model ids, sorted', async () => {
    const { fetchImpl, calls } = fakeFetch(() =>
      json(200, {
        data: [
          { id: 'gpt-5-mini' },
          { id: 'gpt-4.1' },
          { id: 'text-embedding-3-small' },
        ],
      }),
    );
    const models = await cloud(fetchImpl).listModels();
    expect(models.map((m) => m.id)).toEqual([
      'gpt-4.1',
      'gpt-5-mini',
      'text-embedding-3-small',
    ]);
    expect(calls[0].url).toBe('https://api.openai.com/v1/models');
  });
});
