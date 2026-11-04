import { createHash } from 'node:crypto';
import type { ProviderKind } from './llm.types';

export const PROVIDER_KINDS = [
  'ANTHROPIC',
  'GEMINI',
  'OPENAI',
  'SELF_HOSTED',
] as const satisfies readonly ProviderKind[];

/** Kinds that send data to a foreign cloud: each is a cross-border transfer of personal data. */
export const CLOUD_KINDS = [
  'ANTHROPIC',
  'GEMINI',
  'OPENAI',
] as const satisfies readonly ProviderKind[];

export const isCloudKind = (kind: ProviderKind): boolean =>
  (CLOUD_KINDS as readonly ProviderKind[]).includes(kind);

/** Stable wire codes: the UI translates them, the server never sends display text. */
export type ProviderRuleCode =
  | 'LABEL_REQUIRED'
  | 'MODEL_REQUIRED'
  | 'API_KEY_INVALID'
  | 'BASE_URL_NOT_ALLOWED'
  | 'BASE_URL_REQUIRED'
  | 'BASE_URL_INVALID';

export interface RuleViolation {
  code: ProviderRuleCode;
  field: 'label' | 'model' | 'apiKey' | 'baseUrl';
}

export interface ProviderInput {
  kind: ProviderKind;
  label: string;
  model: string;
  baseUrl?: string | null;
  apiKey?: string | null;
}

const MIN_KEY_LENGTH = 8;

/** Returns a plain http(s) URL without a trailing slash, or null if it is unusable. */
export function normalizeBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return url.toString().replace(/\/+$/, '');
}

export function validateProviderInput(
  input: ProviderInput,
  options: { requireKey: boolean },
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (!input.label.trim())
    violations.push({ code: 'LABEL_REQUIRED', field: 'label' });
  if (!input.model.trim())
    violations.push({ code: 'MODEL_REQUIRED', field: 'model' });

  const key = input.apiKey?.trim() ?? '';
  const keyGiven = key.length > 0;
  if (
    (options.requireKey || keyGiven) &&
    (key.length < MIN_KEY_LENGTH || /\s/.test(key))
  ) {
    violations.push({ code: 'API_KEY_INVALID', field: 'apiKey' });
  }

  const baseUrl = input.baseUrl?.trim() ?? '';
  if (isCloudKind(input.kind)) {
    if (baseUrl)
      violations.push({ code: 'BASE_URL_NOT_ALLOWED', field: 'baseUrl' });
  } else if (!baseUrl) {
    violations.push({ code: 'BASE_URL_REQUIRED', field: 'baseUrl' });
  } else if (normalizeBaseUrl(baseUrl) === null) {
    violations.push({ code: 'BASE_URL_INVALID', field: 'baseUrl' });
  }
  return violations;
}

/**
 * Fingerprint of everything a key test vouches for. A passing test stores it; a role is allowed only while the
 * current values still produce the same fingerprint, so changing the key, model, kind or URL invalidates the test.
 */
export function providerFingerprint(input: {
  kind: ProviderKind;
  model: string;
  baseUrl: string | null;
  apiKey: string;
}): string {
  return createHash('sha256')
    .update(
      [input.kind, input.model, input.baseUrl ?? '', input.apiKey].join(
        '\u0000',
      ),
    )
    .digest('hex');
}

export type RoleBlocker =
  | 'ARCHIVED'
  | 'NOT_TESTED'
  | 'TRANSFER_ASSESSMENT_REQUIRED';

/** Why a provider cannot hold a role right now, or null when it can. */
export function roleBlocker(args: {
  kind: ProviderKind;
  testedFingerprint: string | null;
  currentFingerprint: string;
  transferAssessmentActive: boolean;
  archived: boolean;
}): RoleBlocker | null {
  if (args.archived) return 'ARCHIVED';
  if (
    args.testedFingerprint === null ||
    args.testedFingerprint !== args.currentFingerprint
  ) {
    return 'NOT_TESTED';
  }
  if (isCloudKind(args.kind) && !args.transferAssessmentActive) {
    return 'TRANSFER_ASSESSMENT_REQUIRED';
  }
  return null;
}
