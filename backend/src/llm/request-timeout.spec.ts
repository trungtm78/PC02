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
