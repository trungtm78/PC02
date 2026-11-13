/** Turns a refused `/authz` request into words. Pure apart from reading the error object. */
import { extractApiError } from '@/lib/api-errors';
import { permissions as L, permissionErrorText } from '@/locales/permissions.vi';
import { isRecordScoped, permissionLabel, reachLabel, type CatalogueIndex } from './labels';
import { AUTHZ_ERROR, PROBLEM, type Problem, type ProblemCode } from './types';

export interface ExplainedError {
  code?: string;
  /** The headline. */
  message: string;
  /** The reasons under it (why a change is invalid, which teams use a template). */
  reasons: string[];
  /** Somebody else changed it meanwhile: the way forward is to load again. */
  conflict: boolean;
  /** A sensitive grant was refused for want of a reason: typing one and trying again is the way forward. */
  needsReason: boolean;
}

/** `extractApiError` hands object details over as JSON text, one per message; anything that is not an object is left out. */
function parseDetails(messages: readonly string[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const message of messages) {
    try {
      const parsed: unknown = JSON.parse(message);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) out.push(parsed as Record<string, unknown>);
    } catch {
      // Plain words, not a detail object.
    }
  }
  return out;
}

const KNOWN_PROBLEMS = new Set<string>(Object.values(PROBLEM));

export function parseProblems(messages: readonly string[]): Problem[] {
  return parseDetails(messages)
    .filter((d) => typeof d.code === 'string')
    .map((d) => d as unknown as Problem);
}

/** One reason of an invalid change, in plain words. */
export function problemText(index: CatalogueIndex, problem: Problem): string {
  if (!KNOWN_PROBLEMS.has(problem.code)) return L.problemUnknown(String(problem.code));
  const permission = problem.permission ?? '';
  const scoped = isRecordScoped(index, permission);
  const what = permission ? permissionLabel(index, permission) : '';
  return L.problems[problem.code as ProblemCode](what, reachLabel(problem.reach, scoped), reachLabel(problem.viewReach, scoped));
}

export function explainError(err: unknown, index: CatalogueIndex): ExplainedError {
  const { code, message, messages } = extractApiError(err, L.common.unknownError);
  const explained: ExplainedError = {
    code,
    message: permissionErrorText(code, message),
    reasons: [],
    conflict: code === AUTHZ_ERROR.REVISION_CONFLICT || code === AUTHZ_ERROR.CHANGED_SINCE || code === AUTHZ_ERROR.EXPECTED_REVISION_REQUIRED,
    needsReason: false,
  };
  if (code === AUTHZ_ERROR.INVALID) {
    const problems = parseProblems(messages);
    explained.reasons = [...new Set(problems.map((p) => problemText(index, p)))];
    explained.needsReason = problems.some((p) => p.code === PROBLEM.SENSITIVE_REASON_REQUIRED);
  } else if (code === AUTHZ_ERROR.TEMPLATE_IN_USE) {
    explained.reasons = parseDetails(messages)
      .map((d) => (typeof d.name === 'string' ? d.name : typeof d.teamId === 'string' ? d.teamId : ''))
      .filter(Boolean);
  }
  return explained;
}
