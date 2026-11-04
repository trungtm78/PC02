import {
  callWithPolicy,
  LlmExhaustedError,
  type CallDeps,
  type Validation,
} from './call-policy';
import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './llm.types';

const request: LlmRequest = {
  system: 's',
  userText: 'u',
  schemaName: 'x',
  schema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  maxOutputTokens: 10,
};

const result = (
  kind: LlmResult['providerKind'],
  model: string,
  json: unknown = { ok: true },
): LlmResult => ({
  json,
  usage: { inputTokens: 5, outputTokens: 3 },
  latencyMs: 40,
  model,
  providerKind: kind,
});

interface Scripted extends LlmProvider {
  calls: number;
  requests: LlmRequest[];
}

function scripted(
  kind: LlmProvider['kind'],
  model: string,
  steps: Array<LlmResult | LlmError>,
): Scripted {
  const provider: Scripted = {
    kind,
    model,
    calls: 0,
    requests: [],
    call(asked) {
      provider.requests.push(asked);
      const step = steps[Math.min(provider.calls, steps.length - 1)];
      provider.calls += 1;
      return step instanceof LlmError
        ? Promise.reject(step)
        : Promise.resolve(step);
    },
    listModels: () => Promise.resolve([]),
  };
  return provider;
}

const rateLimit = (ms?: number) =>
  new LlmError('RATE_LIMIT', 'slow', { retryable: true, retryAfterMs: ms });
const auth = () => new LlmError('AUTH', 'bad key', { retryable: false });
const server = () => new LlmError('SERVER', 'boom', { retryable: true });
const badRequest = () =>
  new LlmError('BAD_REQUEST', 'schema', { retryable: false });

const accept = (json: unknown): Validation<unknown> => ({
  ok: true,
  value: json,
});
const requireOk = (json: unknown): Validation<unknown> =>
  (json as { ok?: boolean }).ok === true
    ? { ok: true, value: json }
    : { ok: false, issues: ['bad shape'] };

const policy = {
  maxAttemptsPerProvider: 3,
  baseDelayMs: 100,
  maxDelayMs: 1000,
};

function deps(): CallDeps & { delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    },
  };
}

async function exhausted(
  promise: Promise<unknown>,
): Promise<LlmExhaustedError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof LlmExhaustedError) return error;
    throw error;
  }
  throw new Error('expected LlmExhaustedError');
}

describe('callWithPolicy', () => {
  it('returns the first success and records one lineage entry without any content', async () => {
    const p = scripted('ANTHROPIC', 'm1', [result('ANTHROPIC', 'm1')]);
    const out = await callWithPolicy([p], request, accept, policy, deps());
    expect(out.result.json).toEqual({ ok: true });
    expect(out.attempts).toEqual([
      {
        providerKind: 'ANTHROPIC',
        model: 'm1',
        outcome: 'OK',
        latencyMs: 40,
        inputTokens: 5,
        outputTokens: 3,
      },
    ]);
    expect(JSON.stringify(out.attempts)).not.toContain('"u"');
  });

  it('retries a rate limit, honouring Retry-After but never beyond the cap', async () => {
    const d = deps();
    const p = scripted('ANTHROPIC', 'm1', [
      rateLimit(500),
      rateLimit(60_000),
      result('ANTHROPIC', 'm1'),
    ]);
    const out = await callWithPolicy([p], request, accept, policy, d);
    expect(out.result.model).toBe('m1');
    expect(d.delays).toEqual([500, 1000]);
    expect(out.attempts.map((a) => a.outcome)).toEqual([
      'RATE_LIMIT',
      'RATE_LIMIT',
      'OK',
    ]);
  });

  it('uses exponential backoff when the provider gives no delay', async () => {
    const d = deps();
    const p = scripted('ANTHROPIC', 'm1', [
      server(),
      server(),
      result('ANTHROPIC', 'm1'),
    ]);
    await callWithPolicy([p], request, accept, policy, d);
    expect(d.delays).toEqual([100, 200]);
  });

  it('falls back to the next provider after the attempts on the first are used up', async () => {
    const first = scripted('ANTHROPIC', 'm1', [server()]);
    const second = scripted('GEMINI', 'g1', [result('GEMINI', 'g1')]);
    const out = await callWithPolicy(
      [first, second],
      request,
      accept,
      policy,
      deps(),
    );
    expect(first.calls).toBe(3);
    expect(second.calls).toBe(1);
    expect(out.result.providerKind).toBe('GEMINI');
    expect(out.attempts.map((a) => a.providerKind)).toEqual([
      'ANTHROPIC',
      'ANTHROPIC',
      'ANTHROPIC',
      'GEMINI',
    ]);
  });

  it('does not retry an authentication error but still falls back', async () => {
    const first = scripted('ANTHROPIC', 'm1', [auth()]);
    const second = scripted('GEMINI', 'g1', [result('GEMINI', 'g1')]);
    const out = await callWithPolicy(
      [first, second],
      request,
      accept,
      policy,
      deps(),
    );
    expect(first.calls).toBe(1);
    expect(out.result.providerKind).toBe('GEMINI');
  });

  it('stops at once on a bad request: another provider would refuse the same request', async () => {
    const first = scripted('ANTHROPIC', 'm1', [badRequest()]);
    const second = scripted('GEMINI', 'g1', [result('GEMINI', 'g1')]);
    await exhausted(
      callWithPolicy([first, second], request, accept, policy, deps()),
    );
    expect(second.calls).toBe(0);
  });

  it('re-asks once when the reply fails validation, then falls back', async () => {
    const first = scripted('ANTHROPIC', 'm1', [
      result('ANTHROPIC', 'm1', { nope: 1 }),
    ]);
    const second = scripted('GEMINI', 'g1', [result('GEMINI', 'g1')]);
    const out = await callWithPolicy(
      [first, second],
      request,
      requireOk,
      policy,
      deps(),
    );
    expect(first.calls).toBe(2);
    expect(out.result.providerKind).toBe('GEMINI');
    expect(out.attempts.filter((a) => a.outcome === 'BAD_JSON')).toHaveLength(
      2,
    );
  });

  it('tells the model which fields were wrong when it re-asks, naming paths only', async () => {
    const p = scripted('ANTHROPIC', 'm1', [
      result('ANTHROPIC', 'm1', { secret: 'personal value' }),
      result('ANTHROPIC', 'm1', { ok: true }),
    ]);
    const validate = (json: unknown): Validation<unknown> =>
      (json as { ok?: boolean }).ok
        ? { ok: true, value: json }
        : {
            ok: false,
            issues: ['points: expected array', 'summary: required'],
          };
    await callWithPolicy([p], request, validate, policy, deps());
    expect(p.requests[0].userText).toBe('u');
    expect(p.requests[1].userText).toContain('u');
    expect(p.requests[1].userText).toContain('points: expected array');
    expect(p.requests[1].userText).toContain('summary: required');
    expect(p.requests[1].userText).not.toContain('personal value');
  });

  it('keeps what it echoes back to the model short, however long a reported issue is', async () => {
    const p = scripted('ANTHROPIC', 'm1', [
      result('ANTHROPIC', 'm1', { nope: 1 }),
      result('ANTHROPIC', 'm1', { ok: true }),
    ]);
    const long = 'k'.repeat(5000);
    const validate = (json: unknown): Validation<unknown> =>
      (json as { ok?: boolean }).ok
        ? { ok: true, value: json }
        : { ok: false, issues: [`Unrecognized key: "${long}"`] };
    await callWithPolicy([p], request, validate, policy, deps());
    expect(p.requests[1].userText.length).toBeLessThan(1000);
  });

  it('recovers when the second try after bad JSON validates', async () => {
    const p = scripted('ANTHROPIC', 'm1', [
      result('ANTHROPIC', 'm1', { nope: 1 }),
      result('ANTHROPIC', 'm1', { ok: true }),
    ]);
    const out = await callWithPolicy([p], request, requireOk, policy, deps());
    expect(out.result.json).toEqual({ ok: true });
    expect(p.calls).toBe(2);
  });

  it('throws LlmExhaustedError with every attempt when all providers fail', async () => {
    const a = scripted('ANTHROPIC', 'm1', [server()]);
    const b = scripted('GEMINI', 'g1', [server()]);
    const error = await exhausted(
      callWithPolicy([a, b], request, accept, policy, deps()),
    );
    expect(error.attempts).toHaveLength(6);
    expect(error.message).not.toContain('"u"');
  });

  it('refuses an empty provider chain', async () => {
    await expect(
      callWithPolicy([], request, accept, policy, deps()),
    ).rejects.toThrow('no provider');
  });
});
