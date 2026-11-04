import { AnthropicProvider } from './anthropic.adapter';
import { GeminiProvider } from './gemini.adapter';
import { OpenAiCompatibleProvider } from './openai-compatible.adapter';
import { LlmProviderFactory } from './provider-factory';

const factory = new LlmProviderFactory();

describe('LlmProviderFactory', () => {
  it("builds the adapter that speaks each kind's protocol", () => {
    const anthropic = factory.create({
      kind: 'ANTHROPIC',
      model: 'claude-haiku-5-5',
      baseUrl: null,
      apiKey: 'k',
    });
    const gemini = factory.create({
      kind: 'GEMINI',
      model: 'gemini-2.5-flash',
      baseUrl: null,
      apiKey: 'k',
    });
    const openai = factory.create({
      kind: 'OPENAI',
      model: 'gpt-5-mini',
      baseUrl: null,
      apiKey: 'k',
    });
    const own = factory.create({
      kind: 'SELF_HOSTED',
      model: 'qwen',
      baseUrl: 'http://10.0.0.5:8000',
      apiKey: '',
    });

    expect(anthropic).toBeInstanceOf(AnthropicProvider);
    expect(gemini).toBeInstanceOf(GeminiProvider);
    expect(openai).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(own).toBeInstanceOf(OpenAiCompatibleProvider);
    expect([anthropic.kind, gemini.kind, openai.kind, own.kind]).toEqual([
      'ANTHROPIC',
      'GEMINI',
      'OPENAI',
      'SELF_HOSTED',
    ]);
  });

  it('ignores a base URL on cloud kinds: their host is fixed, so a key cannot be sent anywhere else', () => {
    const openai = factory.create({
      kind: 'OPENAI',
      model: 'm',
      baseUrl: 'http://evil.example',
      apiKey: 'k',
    });
    expect(openai).toBeInstanceOf(OpenAiCompatibleProvider);
    // The adapter never reads a base URL for the cloud kind; its own spec proves the fixed host.
    expect((openai as unknown as { baseUrl: string }).baseUrl).toBe(
      'https://api.openai.com',
    );
  });

  it('refuses a self-hosted provider that has no base URL, with a stable error code', () => {
    let code: string | undefined;
    try {
      factory.create({
        kind: 'SELF_HOSTED',
        model: 'm',
        baseUrl: null,
        apiKey: '',
      });
    } catch (error) {
      code = (
        error as { getResponse?: () => { code?: string } }
      ).getResponse?.().code;
    }
    expect(code).toBe('LLM_PROVIDER_INVALID');
  });
});
