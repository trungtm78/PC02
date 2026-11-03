import { runKeyTest, type KeyTestReport } from './key-test';
import {
  KEY_TEST_EXPECTED_TEXTS,
  KEY_TEST_IMAGE_BASE64,
} from './key-test-image';
import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './llm.types';

const result = (json: unknown, tokens = [10, 5]): LlmResult => ({
  json,
  usage: { inputTokens: tokens[0], outputTokens: tokens[1] },
  latencyMs: 100,
  model: 'claude-haiku-5-5',
  providerKind: 'ANTHROPIC',
});

const goodRead = {
  transcript: 'Họ và tên: Nguyễn Thị Hương\nSố tiền: 495.253.647 đồng',
};
const goodSchema = { status: 'READY', items: ['a'], note: null };

interface Fake extends LlmProvider {
  requests: LlmRequest[];
}

function fake(options: {
  models?: string[] | Error;
  /** A reply object, or an Error to throw. */
  read?: unknown;
  schema?: unknown;
}): Fake {
  const requests: LlmRequest[] = [];
  return {
    kind: 'ANTHROPIC',
    model: 'claude-haiku-5-5',
    requests,
    listModels() {
      const m = options.models ?? ['claude-haiku-5-5'];
      return m instanceof Error
        ? Promise.reject(m)
        : Promise.resolve(m.map((id) => ({ id })));
    },
    call(request: LlmRequest) {
      requests.push(request);
      const outcome = request.images?.length
        ? (options.read ?? goodRead)
        : (options.schema ?? goodSchema);
      return outcome instanceof Error
        ? Promise.reject(outcome)
        : Promise.resolve(result(outcome));
    },
  };
}

const summary = (r: KeyTestReport) =>
  r.steps.map((s) => `${s.id}:${s.ok ? 'ok' : (s.code ?? 'fail')}`);

describe('runKeyTest', () => {
  it('passes every step and reports tokens and latency', async () => {
    const report = await runKeyTest(fake({}));
    expect(report.ok).toBe(true);
    expect(summary(report)).toEqual([
      'NETWORK:ok',
      'KEY:ok',
      'MODEL:ok',
      'READ_IMAGE:ok',
      'SCHEMA:ok',
    ]);
    expect(report.inputTokens).toBe(20);
    expect(report.outputTokens).toBe(10);
    expect(report.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('sends the synthetic image to the provider, and nothing else sensitive', async () => {
    const provider = fake({});
    await runKeyTest(provider);
    const withImage = provider.requests.find((r) => r.images?.length);
    expect(withImage?.images?.[0].dataBase64).toBe(KEY_TEST_IMAGE_BASE64);
  });

  it('an unreachable provider fails the network step and skips the rest', async () => {
    const report = await runKeyTest(
      fake({ models: new LlmError('NETWORK', 'down', { retryable: true }) }),
    );
    expect(report.ok).toBe(false);
    expect(summary(report)).toEqual([
      'NETWORK:NETWORK',
      'KEY:SKIPPED',
      'MODEL:SKIPPED',
      'READ_IMAGE:SKIPPED',
      'SCHEMA:SKIPPED',
    ]);
  });

  it('a rejected key proves the network works but fails the key step', async () => {
    const report = await runKeyTest(
      fake({ models: new LlmError('AUTH', 'bad', { retryable: false }) }),
    );
    expect(summary(report).slice(0, 3)).toEqual([
      'NETWORK:ok',
      'KEY:AUTH',
      'MODEL:SKIPPED',
    ]);
    expect(report.ok).toBe(false);
  });

  it('a model missing from the provider list fails the model step', async () => {
    const report = await runKeyTest(fake({ models: ['some-other-model'] }));
    expect(summary(report)[2]).toBe('MODEL:MODEL_NOT_FOUND');
    expect(report.ok).toBe(false);
  });

  it('a provider that cannot list models does not fail the model step', async () => {
    const report = await runKeyTest(fake({ models: [] }));
    expect(report.ok).toBe(true);
  });

  it('a wrong reading of the image fails the read step: the API works but the model cannot read Vietnamese', async () => {
    const report = await runKeyTest(
      fake({ read: { transcript: 'Ho va ten: Nguyen Thi Huong' } }),
    );
    expect(summary(report)[3]).toBe('READ_IMAGE:READ_MISMATCH');
    expect(summary(report)[4]).toBe('SCHEMA:SKIPPED');
  });

  it('accepts a decomposed (NFD) transcript and irregular spacing', async () => {
    const nfd = 'Họ   và tên:  Nguyễn Thị Hương\n495.253.647'.normalize('NFD');
    const report = await runKeyTest(fake({ read: { transcript: nfd } }));
    expect(report.ok).toBe(true);
  });

  it('a reply that does not match the schema fails the schema step', async () => {
    const report = await runKeyTest(
      fake({ schema: { status: 'WRONG', items: 'not-an-array' } }),
    );
    expect(summary(report)[4]).toBe('SCHEMA:SCHEMA_MISMATCH');
  });

  it('a provider error during a call is reported with its code', async () => {
    const report = await runKeyTest(
      fake({ read: new LlmError('RATE_LIMIT', 'slow', { retryable: true }) }),
    );
    expect(summary(report)[3]).toBe('READ_IMAGE:RATE_LIMIT');
  });

  it('never puts the transcript or the image into the report', async () => {
    const report = await runKeyTest(fake({}));
    const text = JSON.stringify(report);
    expect(text).not.toContain('Nguyễn');
    expect(text).not.toContain(KEY_TEST_IMAGE_BASE64.slice(0, 40));
  });

  it('expected texts are what the image shows, so the check is meaningful', () => {
    expect(KEY_TEST_EXPECTED_TEXTS).toContain('Nguyễn Thị Hương');
    expect(KEY_TEST_EXPECTED_TEXTS).toContain('495.253.647');
  });
});
