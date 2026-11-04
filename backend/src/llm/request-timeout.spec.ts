import { AnthropicProvider } from './anthropic.adapter';
import { GeminiProvider } from './gemini.adapter';
import { OpenAiCompatibleProvider } from './openai-compatible.adapter';
import type { LlmProvider, LlmRequest } from './llm.types';

const request: LlmRequest = {
  system: 's',
  userText: 'u',
  schemaName: 'submit_evidence',
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
  maxOutputTokens: 100,
};

/** One reply that every provider's parser accepts. */
const reply = () =>
  new Response(
    JSON.stringify({
      content: [{ type: 'tool_use', input: { ok: true } }],
      candidates: [
        {
          content: { parts: [{ text: '{"ok":true}' }] },
          finishReason: 'STOP',
        },
      ],
      choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'tool_use',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const fetchImpl = (() => Promise.resolve(reply())) as unknown as typeof fetch;

const providers: Array<[string, () => LlmProvider]> = [
  [
    'Anthropic',
    () => new AnthropicProvider({ apiKey: 'k', model: 'm', fetchImpl }),
  ],
  ['Gemini', () => new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl })],
  [
    'OpenAI',
    () =>
      new OpenAiCompatibleProvider({
        kind: 'OPENAI',
        apiKey: 'k',
        model: 'm',
        fetchImpl,
      }),
  ],
];

describe.each(providers)('%s: time allowed for one call', (_name, build) => {
  afterEach(() => jest.restoreAllMocks());

  it("is the request's own limit when it sets one, so a long analysis is not cut off at the default", async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    await build().call({ ...request, timeoutMs: 400_000 });
    expect(spy).toHaveBeenCalledWith(400_000);
  });

  it('is the provider default when the request does not set one', async () => {
    const spy = jest.spyOn(AbortSignal, 'timeout');
    await build().call(request);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalledWith(400_000);
  });
});

describe('Gemini output limit', () => {
  it('never asks for more output than the model can give, however long the analysis budget is', async () => {
    const seen: number[] = [];
    const capture = ((_url: string, init: RequestInit) => {
      const sent = JSON.parse(init.body as string) as {
        generationConfig: { maxOutputTokens: number };
      };
      seen.push(sent.generationConfig.maxOutputTokens);
      return Promise.resolve(reply());
    }) as unknown as typeof fetch;
    const gemini = new GeminiProvider({
      apiKey: 'k',
      model: 'm',
      fetchImpl: capture,
    });
    // The analysis of a long bundle asks for 64,000; with room for thinking that is above Gemini's 65,536.
    await gemini.call({ ...request, maxOutputTokens: 64_000 });
    await gemini.call({ ...request, maxOutputTokens: 1_000 });
    expect(seen[0]).toBe(65_536);
    expect(seen[1]).toBe(1_000 + 8_192);
  });
});
