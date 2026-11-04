import { AnthropicProvider } from './anthropic.adapter';
import { callWithPolicy } from './call-policy';
import { GeminiProvider } from './gemini.adapter';
import { LlmError, type LlmProvider, type LlmRequest } from './llm.types';
import { OpenAiCompatibleProvider } from './openai-compatible.adapter';
import { refusesOutputLength } from './output-limit';

const request: LlmRequest = {
  system: 's',
  userText: 'u',
  schemaName: 'submit_evidence',
  schema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  maxOutputTokens: 24_000,
};

describe('refusesOutputLength', () => {
  it('recognises how each provider says the requested answer is longer than the model gives', () => {
    expect(
      refusesOutputLength(
        'max_tokens is too large: 24000. This model supports at most 16384 completion tokens, whereas you provided 24000.',
      ),
    ).toBe(true);
    expect(
      refusesOutputLength(
        'max_tokens: 64000 > 32000, which is the maximum allowed number of output tokens for the model',
      ),
    ).toBe(true);
    expect(
      refusesOutputLength(
        'Unable to submit request because it has a maxOutputTokens value of 72192 but the supported range is from 1 to 65537',
      ),
    ).toBe(true);
  });

  it('does not take other refusals for it', () => {
    expect(
      refusesOutputLength('tool_choice: type "tool" is not supported'),
    ).toBe(false);
    expect(
      refusesOutputLength('messages: at least one message is required'),
    ).toBe(false);
    expect(refusesOutputLength(undefined)).toBe(false);
  });
});

const refusal = (message: string) =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify({ error: { message } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )) as unknown as typeof fetch;

const providers: Array<[string, (fetchImpl: typeof fetch) => LlmProvider]> = [
  [
    'Anthropic',
    (fetchImpl) =>
      new AnthropicProvider({
        apiKey: 'sk-test-0123456789abcdef',
        model: 'm',
        fetchImpl,
      }),
  ],
  [
    'Gemini',
    (fetchImpl) =>
      new GeminiProvider({
        apiKey: 'sk-test-0123456789abcdef',
        model: 'm',
        fetchImpl,
      }),
  ],
  [
    'OpenAI',
    (fetchImpl) =>
      new OpenAiCompatibleProvider({
        kind: 'OPENAI',
        apiKey: 'sk-test-0123456789abcdef',
        model: 'm',
        fetchImpl,
      }),
  ],
];

describe.each(providers)(
  '%s: a 400 about the answer length',
  (_name, build) => {
    it('is reported as OUTPUT_LIMIT, not as a bad request that would stop every provider', async () => {
      const provider = build(
        refusal(
          'max_tokens is too large: 24000. This model supports at most 16384 completion tokens',
        ),
      );
      const error = await provider.call(request).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LlmError);
      expect((error as LlmError).code).toBe('OUTPUT_LIMIT');
      expect((error as LlmError).retryable).toBe(false);
    });

    it('leaves any other 400 as a bad request', async () => {
      const provider = build(
        refusal('messages: at least one message is required'),
      );
      const error = await provider.call(request).catch((e: unknown) => e);
      expect((error as LlmError).code).toBe('BAD_REQUEST');
    });
  },
);

describe('callWithPolicy with an output-limit refusal', () => {
  it('goes on to the next provider, which may allow a longer answer', async () => {
    let secondCalls = 0;
    const first: LlmProvider = {
      kind: 'OPENAI',
      model: 'small',
      call: () =>
        Promise.reject(
          new LlmError('OUTPUT_LIMIT', 'too long', { retryable: false }),
        ),
      listModels: () => Promise.resolve([]),
    };
    const second: LlmProvider = {
      kind: 'GEMINI',
      model: 'large',
      call: () => {
        secondCalls += 1;
        return Promise.resolve({
          json: { ok: true },
          usage: { inputTokens: 1, outputTokens: 1 },
          latencyMs: 1,
          model: 'large',
          providerKind: 'GEMINI' as const,
        });
      },
      listModels: () => Promise.resolve([]),
    };
    const out = await callWithPolicy(
      [first, second],
      request,
      (json) => ({ ok: true, value: json }),
      { maxAttemptsPerProvider: 3, baseDelayMs: 1, maxDelayMs: 1 },
      { sleep: () => Promise.resolve() },
    );
    expect(secondCalls).toBe(1);
    expect(out.result.providerKind).toBe('GEMINI');
  });
});
