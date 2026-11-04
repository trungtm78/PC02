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
  // Haiku answered with a wrongly shaped analysis on 5 of 7 real handwritten bundles; Sonnet read all 7.
  [LlmProviderKind.ANTHROPIC]: { prefer: 'sonnet' },
  [LlmProviderKind.OPENAI]: { prefer: 'mini', avoid: 'nano' },
};

const newestFirst = (a: string, b: string) => b.localeCompare(a, 'en', { numeric: true });

/**
 * The model to preselect from the list a provider returned: Gemini Flash by default, Claude Sonnet, an OpenAI mini
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

/** A readable name for a new provider, so the field is never left to whatever the browser autofills. */
export function defaultLabel(kind: LlmProviderKind): string {
  return t.defaultLabels[kind] ?? '';
}

/**
 * A model that real scans showed to be unreliable for this job. Small Claude models misread handwriting and return an
 * analysis of the wrong shape; the screen says so before the administrator relies on one.
 */
export type ModelWarning = 'SMALL_MODEL';
export function modelWarning(model: string): ModelWarning | null {
  return /haiku/i.test(model) ? 'SMALL_MODEL' : null;
}

export type SetupStepKey = 'KEY' | 'PROVIDER' | 'TEST' | 'ACTIVE';
export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
}

/** The few things that must be true, in the order they must be done, for the scan feature to work. */
export function setupSteps(input: { keyConfigured: boolean; providers: ProviderView[] }): SetupStep[] {
  const live = input.providers.filter((p) => p.archivedAt === null);
  return [
    { key: 'KEY', done: input.keyConfigured },
    { key: 'PROVIDER', done: live.length > 0 },
    { key: 'TEST', done: live.some((p) => testBadge(p) === 'PASSED') },
    { key: 'ACTIVE', done: live.some((p) => p.role === 'PRIMARY') },
  ];
}

/** The first step still to do, or null when everything is in place. */
export function nextStep(steps: SetupStep[]): SetupStep | null {
  return steps.find((s) => !s.done) ?? null;
}

export type RoleGate = 'ARCHIVED' | 'NOT_TESTED';

/** What stands between a provider and a role: the same rule, in the same order, the server applies. */
export function roleGate(provider: ProviderView): RoleGate | null {
  if (provider.archivedAt !== null) return 'ARCHIVED';
  if (testBadge(provider) !== 'PASSED') return 'NOT_TESTED';
  return null;
}
