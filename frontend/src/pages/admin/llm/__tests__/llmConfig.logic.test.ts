import { describe, it, expect } from 'vitest';
import {
  decodeApiError,
  defaultLabel,
  isCloudKind,
  microToUsdPerMTok,
  modelWarning,
  nextStep,
  pickDefaultModel,
  roleGate,
  setupSteps,
  testBadge,
  usdPerMTokToMicro,
} from '../llmConfig.logic';
import type { ProviderView } from '../llmApi';

describe('isCloudKind', () => {
  it('only the self-hosted kind keeps data inside the unit', () => {
    expect(isCloudKind('ANTHROPIC')).toBe(true);
    expect(isCloudKind('GEMINI')).toBe(true);
    expect(isCloudKind('OPENAI')).toBe(true);
    expect(isCloudKind('SELF_HOSTED')).toBe(false);
  });
});

describe('pickDefaultModel', () => {
  it('defaults Gemini to a Flash model, never a Flash-Lite or Pro one when a plain Flash exists', () => {
    expect(
      pickDefaultModel('GEMINI', [
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
      ]),
    ).toBe('gemini-2.5-flash');
  });

  it('takes the newest Flash when several exist', () => {
    expect(pickDefaultModel('GEMINI', ['gemini-2.5-flash', 'gemini-3-flash'])).toBe(
      'gemini-3-flash',
    );
  });

  it('defaults Anthropic to Sonnet (Haiku misreads handwritten paperwork) and OpenAI to a mini model', () => {
    expect(
      pickDefaultModel('ANTHROPIC', ['claude-opus-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5']),
    ).toBe('claude-sonnet-5-5');
    expect(pickDefaultModel('OPENAI', ['gpt-5', 'gpt-5-mini'])).toBe('gpt-5-mini');
  });

  it('falls back to the first model, or null for an empty list', () => {
    expect(pickDefaultModel('SELF_HOSTED', ['qwen2.5-vl', 'llava'])).toBe('qwen2.5-vl');
    expect(pickDefaultModel('GEMINI', ['gemini-pro-only'])).toBe('gemini-pro-only');
    expect(pickDefaultModel('GEMINI', [])).toBeNull();
  });
});

describe('price conversion (USD per million tokens <-> micro-USD)', () => {
  it('converts what the administrator types into whole micro-USD', () => {
    expect(usdPerMTokToMicro('1')).toBe(1_000_000);
    expect(usdPerMTokToMicro('0.25')).toBe(250_000);
    expect(usdPerMTokToMicro('1,5')).toBe(1_500_000);
  });
  it('treats empty as unknown and rejects negatives and text', () => {
    expect(usdPerMTokToMicro('')).toBeNull();
    expect(usdPerMTokToMicro('  ')).toBeNull();
    expect(Number.isNaN(usdPerMTokToMicro('-1'))).toBe(true);
    expect(Number.isNaN(usdPerMTokToMicro('abc'))).toBe(true);
  });
  it('shows a stored price back without float noise', () => {
    expect(microToUsdPerMTok(1_500_000)).toBe('1.5');
    expect(microToUsdPerMTok(250_000)).toBe('0.25');
    expect(microToUsdPerMTok(null)).toBe('');
  });
});

describe('decodeApiError', () => {
  it('reads the stable code and the details array from the error envelope', () => {
    const error = {
      response: {
        data: {
          success: false,
          code: 'LLM_ROLE_BLOCKED',
          error: { code: 'LLM_ROLE_BLOCKED', message: 'x', details: [{ reason: 'NOT_TESTED' }] },
        },
      },
    };
    expect(decodeApiError(error)).toEqual({
      code: 'LLM_ROLE_BLOCKED',
      details: [{ reason: 'NOT_TESTED' }],
      status: undefined,
    });
  });
  it('is safe on anything that is not an API error', () => {
    expect(decodeApiError(new Error('boom'))).toEqual({ code: null, details: [], status: undefined });
    expect(decodeApiError(null)).toEqual({ code: null, details: [], status: undefined });
  });
  it('keeps the HTTP status', () => {
    expect(decodeApiError({ response: { status: 404, data: {} } }).status).toBe(404);
  });
});

describe('testBadge', () => {
  const base = {
    test: { at: null, ok: null, code: null, latencyMs: null, byId: null, current: false },
  } as unknown as ProviderView;
  const withTest = (test: Partial<ProviderView['test']>): ProviderView => ({
    ...base,
    test: { ...base.test, ...test },
  });

  it('is NEVER before any test', () => {
    expect(testBadge(base)).toBe('NEVER');
  });
  it('is PASSED only when the passing test still matches the stored settings', () => {
    expect(testBadge(withTest({ ok: true, current: true }))).toBe('PASSED');
  });
  it('is OUTDATED when a passing test no longer matches (key, model or URL changed)', () => {
    expect(testBadge(withTest({ ok: true, current: false }))).toBe('OUTDATED');
  });
  it('is FAILED after a failing test', () => {
    expect(testBadge(withTest({ ok: false, code: 'AUTH' }))).toBe('FAILED');
  });
});

const provider = (patch: Partial<ProviderView> = {}): ProviderView => ({
  id: 'p1',
  kind: 'ANTHROPIC',
  label: 'Claude',
  apiKeyLast4: 'abcd',
  baseUrl: null,
  model: 'claude-sonnet-5-5',
  dataRegion: null,
  zeroRetention: false,
  prices: { inputMicroUsdPerMTok: null, outputMicroUsdPerMTok: null },
  role: 'OFF',
  fallbackOrder: null,
  archivedAt: null,
  test: { at: null, ok: null, code: null, latencyMs: null, byId: null, current: false },
  ...patch,
} as ProviderView);

const tested = (patch: Partial<ProviderView> = {}) =>
  provider({ test: { at: 'x', ok: true, code: null, latencyMs: 1, byId: null, current: true }, ...patch });

describe('setupSteps and nextStep', () => {
  it('walks an empty server through the order the administrator has to follow', () => {
    const none = setupSteps({ keyConfigured: false, providers: [] });
    expect(none.map((s) => [s.key, s.done])).toEqual([
      ['KEY', false],
      ['PROVIDER', false],
      ['TEST', false],
      ['ACTIVE', false],
    ]);
    expect(nextStep(none)?.key).toBe('KEY');
  });

  it('moves on one step at a time: key, provider, test, then in use', () => {
    expect(nextStep(setupSteps({ keyConfigured: true, providers: [] }))?.key).toBe('PROVIDER');
    expect(nextStep(setupSteps({ keyConfigured: true, providers: [provider()] }))?.key).toBe('TEST');
    expect(nextStep(setupSteps({ keyConfigured: true, providers: [tested()] }))?.key).toBe('ACTIVE');
  });

  it('is finished when a tested provider holds the primary role', () => {
    const done = setupSteps({ keyConfigured: true, providers: [tested({ role: 'PRIMARY' })] });
    expect(done.every((s) => s.done)).toBe(true);
    expect(nextStep(done)).toBeNull();
  });

  it('does not count an archived provider, nor a test that no longer matches the saved settings', () => {
    const steps = setupSteps({
      keyConfigured: true,
      providers: [
        tested({ archivedAt: '2026-11-01T00:00:00Z', role: 'PRIMARY' }),
        provider({ test: { at: 'x', ok: true, code: null, latencyMs: 1, byId: null, current: false } }),
      ],
    });
    expect(steps.find((s) => s.key === 'TEST')?.done).toBe(false);
    expect(steps.find((s) => s.key === 'ACTIVE')?.done).toBe(false);
  });
});

describe('setupSteps: in use means a provider that can actually be called', () => {
  it('does not report "in use" for a primary whose test no longer matches, even when another provider passed', () => {
    const steps = setupSteps({
      keyConfigured: true,
      providers: [
        // The primary was edited (or its key rotated): its test is out of date, so the server will not call it.
        provider({
          id: 'old',
          role: 'PRIMARY',
          test: { at: 'x', ok: true, code: null, latencyMs: 1, byId: null, current: false },
        }),
        tested({ id: 'new', role: 'OFF' }),
      ],
    });
    expect(steps.find((s) => s.key === 'TEST')?.done).toBe(true);
    expect(steps.find((s) => s.key === 'ACTIVE')?.done).toBe(false);
    expect(nextStep(steps)?.key).toBe('ACTIVE');
  });
});

describe('roleGate', () => {
  it('names what stands between a provider and a role: only the test, for a cloud provider as for any other', () => {
    expect(roleGate(provider())).toBe('NOT_TESTED');
    expect(roleGate(tested())).toBeNull();
    expect(roleGate(tested({ kind: 'SELF_HOSTED' }))).toBeNull();
    expect(roleGate(tested({ archivedAt: '2026-11-01T00:00:00Z' }))).toBe('ARCHIVED');
  });
});

describe('modelWarning', () => {
  it('warns about a small model that real handwritten paperwork showed to be unreliable', () => {
    expect(modelWarning('claude-haiku-5-5')).toBe('SMALL_MODEL');
    expect(modelWarning('claude-sonnet-5-5')).toBeNull();
    expect(modelWarning('gemini-2.5-flash')).toBeNull();
    expect(modelWarning('')).toBeNull();
  });
});

describe('defaultLabel', () => {
  it('gives a new provider a readable name instead of whatever the browser autofilled', () => {
    expect(defaultLabel('ANTHROPIC')).toBe('Claude');
    expect(defaultLabel('GEMINI')).toBe('Gemini');
    expect(defaultLabel('OPENAI')).toBe('OpenAI');
    expect(defaultLabel('SELF_HOSTED')).toBe('Máy chủ nội bộ');
  });
});
