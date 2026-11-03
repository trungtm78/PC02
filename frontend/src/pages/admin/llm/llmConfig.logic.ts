import { llmConfig as t } from '@/locales/vi';
import { LlmProviderKind } from '@/shared/enums/generated';
import type { ProviderView } from './llmApi';

/** Kinds that send data to a foreign cloud. Only SELF_HOSTED keeps it inside the unit. */
export const isCloudKind = (kind: LlmProviderKind): boolean => kind !== LlmProviderKind.SELF_HOSTED;

/** Every kind has a working adapter. Gemini (Flash) is the default for a new provider. */
export const SUPPORTED_KINDS: readonly LlmProviderKind[] = [
  LlmProviderKind.GEMINI,
  LlmProviderKind.ANTHROPIC,
  LlmProviderKind.OPENAI,
  LlmProviderKind.SELF_HOSTED,
];
export const DEFAULT_KIND: LlmProviderKind = LlmProviderKind.GEMINI;

/** Substring that marks the model family a provider should default to when the administrator has not chosen. */
const PREFERRED: Partial<Record<LlmProviderKind, { prefer: string; avoid?: string }>> = {
  [LlmProviderKind.GEMINI]: { prefer: 'flash', avoid: 'lite' },
  [LlmProviderKind.ANTHROPIC]: { prefer: 'haiku' },
  [LlmProviderKind.OPENAI]: { prefer: 'mini', avoid: 'nano' },
};

const newestFirst = (a: string, b: string) => b.localeCompare(a, 'en', { numeric: true });

/**
 * The model to preselect from the list a provider returned: Gemini Flash by default, Claude Haiku, an OpenAI mini
 * model. Newest wins within the preferred family; with no match the first model is used, so a choice always exists.
 */
export function pickDefaultModel(kind: LlmProviderKind, ids: string[]): string | null {
  if (ids.length === 0) return null;
  const rule = PREFERRED[kind];
  if (rule) {
    const family = ids
      .filter((id) => id.includes(rule.prefer) && !(rule.avoid && id.includes(rule.avoid)))
      .sort(newestFirst);
    if (family.length > 0) return family[0];
  }
  return ids[0];
}

const MICRO_PER_USD = 1_000_000;

/** USD per million tokens as typed ("1,5" or "1.5") to whole micro-USD. Empty = unknown (null); invalid = NaN. */
export function usdPerMTokToMicro(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return Number.NaN;
  return Math.round(value * MICRO_PER_USD);
}

export function microToUsdPerMTok(micro: number | null): string {
  if (micro === null) return '';
  return String(Number((micro / MICRO_PER_USD).toFixed(6)));
}

export interface DecodedError {
  code: string | null;
  details: Array<Record<string, unknown>>;
  status: number | undefined;
}

/** Reads the stable code and details from the server's error envelope; safe on anything else. */
export function decodeApiError(error: unknown): DecodedError {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = response?.data as
    | { code?: unknown; error?: { code?: unknown; details?: unknown } }
    | undefined;
  const code = data?.error?.code ?? data?.code;
  const details = data?.error?.details;
  return {
    code: typeof code === 'string' ? code : null,
    details: Array.isArray(details) ? (details as Array<Record<string, unknown>>) : [],
    status: response?.status,
  };
}

export type TestBadge = 'NEVER' | 'PASSED' | 'OUTDATED' | 'FAILED';

export function testBadge(provider: ProviderView): TestBadge {
  if (provider.test.ok === null) return 'NEVER';
  if (!provider.test.ok) return 'FAILED';
  return provider.test.current ? 'PASSED' : 'OUTDATED';
}

/**
 * Messages for a failed request, from the server's stable code and its details: the rule violations of an invalid
 * provider, the reason a role was blocked, or the cause when the provider itself failed. Never raw server text.
 */
export function describeError(error: unknown): string[] {
  const { code, details } = decodeApiError(error);
  if (!code) return [t.genericFailure];

  const violations = details.flatMap((d) =>
    Array.isArray(d.violations) ? (d.violations as Array<{ code: string }>) : [],
  );
  if (violations.length > 0) return violations.map((v) => t.violations[v.code] ?? t.genericFailure);

  const base = t.errors[code] ?? t.testCodes[code] ?? t.genericFailure;
  const reason = details.map((d) => d.reason).find((r): r is string => typeof r === 'string');
  if (reason) return [`${base} ${t.roleBlocked[reason] ?? ''}`.trim()];
  const cause = details.map((d) => d.cause).find((c): c is string => typeof c === 'string');
  if (cause) return [`${base} ${t.testCodes[cause] ?? ''}`.trim()];
  return [base];
}
