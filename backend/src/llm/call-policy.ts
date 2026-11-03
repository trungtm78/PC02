import {
  LlmError,
  type LlmErrorCode,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
  type ProviderKind,
} from './llm.types';

export interface CallPolicy {
  maxAttemptsPerProvider: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface CallDeps {
  sleep(ms: number): Promise<void>;
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

/** One line of lineage per provider call. Holds no request or reply content. */
export interface AttemptRecord {
  providerKind: ProviderKind;
  model: string;
  outcome: 'OK' | LlmErrorCode;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface PolicyOutcome<T> {
  result: LlmResult;
  value: T;
  attempts: AttemptRecord[];
}

export class LlmExhaustedError extends Error {
  constructor(
    readonly attempts: AttemptRecord[],
    readonly lastError: LlmError | null,
  ) {
    super(
      `all providers failed after ${attempts.length} attempt(s)` +
        (lastError
          ? `; last error ${lastError.code}: ${lastError.message}`
          : ''),
    );
    this.name = 'LlmExhaustedError';
  }
}

/** Failures every provider would repeat: the request itself is wrong. */
const STOPS_THE_CHAIN: readonly LlmErrorCode[] = ['BAD_REQUEST'];

/** How many times a reply that fails validation is asked for again on the same provider. */
const VALIDATION_RETRIES = 1;

function backoffDelay(
  error: LlmError,
  attemptIndex: number,
  policy: CallPolicy,
): number {
  const exponential = policy.baseDelayMs * 2 ** attemptIndex;
  return Math.min(error.retryAfterMs ?? exponential, policy.maxDelayMs);
}

/** Field paths and reasons only (never values, which may be personal data), so the model can repair its own reply. */
function withRejection(request: LlmRequest, issues: readonly string[]): string {
  const listed = issues.slice(0, MAX_ISSUES_SHOWN).join('; ');
  return (
    request.userText +
    String.fromCharCode(10, 10) +
    'Your previous reply was rejected because it did not match the required structure: ' +
    listed +
    '. Return the complete result again, with every required field present.'
  );
}

/** Enough to point at the problem without turning a badly broken reply into a long prompt. */
const MAX_ISSUES_SHOWN = 12;

/**
 * Calls the providers in order with bounded retry, then fails over.
 *
 *  - A retryable failure is retried on the same provider with backoff, honouring Retry-After up to a cap.
 *  - A reply that fails validation is asked for once more, then the provider counts as failed.
 *  - AUTH and exhausted retries fail over to the next provider with the same request and schema.
 *  - BAD_REQUEST stops everything: another provider would refuse the same request.
 */
export async function callWithPolicy<T>(
  chain: readonly LlmProvider[],
  request: LlmRequest,
  validate: (json: unknown) => Validation<T>,
  policy: CallPolicy,
  deps: CallDeps,
): Promise<PolicyOutcome<T>> {
  if (chain.length === 0) throw new Error('no provider configured');
  const attempts: AttemptRecord[] = [];
  let lastError: LlmError | null = null;

  for (const provider of chain) {
    let validationRetriesLeft = VALIDATION_RETRIES;
    // The request as sent to this provider: after a rejected reply it also says which fields were wrong.
    let asked = request;
    for (
      let attemptIndex = 0;
      attemptIndex < policy.maxAttemptsPerProvider;
      attemptIndex += 1
    ) {
      try {
        const result = await provider.call(asked);
        const checked = validate(result.json);
        if (checked.ok) {
          attempts.push({
            providerKind: provider.kind,
            model: provider.model,
            outcome: 'OK',
            latencyMs: result.latencyMs,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          });
          return { result, value: checked.value, attempts };
        }
        attempts.push({
          providerKind: provider.kind,
          model: provider.model,
          outcome: 'BAD_JSON',
          latencyMs: result.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
        });
        lastError = new LlmError(
          'BAD_JSON',
          'the reply did not match the schema',
          { retryable: true },
        );
        if (validationRetriesLeft === 0) break;
        validationRetriesLeft -= 1;
        asked = {
          ...request,
          userText: withRejection(request, checked.issues),
        };
      } catch (error) {
        if (!(error instanceof LlmError)) throw error;
        attempts.push({
          providerKind: provider.kind,
          model: provider.model,
          outcome: error.code,
        });
        lastError = error;
        if (STOPS_THE_CHAIN.includes(error.code))
          throw new LlmExhaustedError(attempts, error);
        if (!error.retryable) break;
        if (attemptIndex < policy.maxAttemptsPerProvider - 1) {
          await deps.sleep(backoffDelay(error, attemptIndex, policy));
        }
      }
    }
  }
  throw new LlmExhaustedError(attempts, lastError);
}
