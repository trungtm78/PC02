import { describe, it, expect } from 'vitest';
import {
  decodeApiError,
  isCloudKind,
  microToUsdPerMTok,
  pickDefaultModel,
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

  it('defaults Anthropic to Haiku and OpenAI to a mini model', () => {
    expect(pickDefaultModel('ANTHROPIC', ['claude-opus-5-5', 'claude-haiku-5-5'])).toBe(
      'claude-haiku-5-5',
    );
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
