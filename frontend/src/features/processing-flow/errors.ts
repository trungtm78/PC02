/** Turns a refused request of the processing screens into words. The server sends CODES; the sentence is ours. */
import axios from 'axios';
import { extractApiError } from '@/lib/api-errors';
import { errorText } from '@/locales/processingFlow.vi';
import { CODE, ERROR_CODES } from './codes';
import type { StepIssue } from './types';

export interface ExplainedError {
  status?: number;
  code?: string;
  /** The sentence to show. */
  message: string;
  /** `error.details` exactly as the server sent it: its shape depends on the code. */
  details: unknown[];
  /** Somebody else changed it meanwhile: the way forward is to load again. */
  conflict: boolean;
}

function detailsOf(err: unknown): unknown[] {
  if (!axios.isAxiosError(err)) return [];
  const data = err.response?.data as { error?: { details?: unknown } } | undefined;
  const details = data?.error?.details;
  return Array.isArray(details) ? details : [];
}

export function explainError(err: unknown): ExplainedError {
  const { code, message, status } = extractApiError(err, '');
  return {
    status,
    code,
    message: errorText(code, message),
    details: detailsOf(err),
    conflict: code === CODE.REVISION_CONFLICT,
  };
}

/**
 * The backend feature switch `processing_flow` is off: the routes answer 404 with no code of the contract. A 404 WITH a
 * contract code ("this flow does not exist") is a different thing and must show its own sentence.
 */
export function isFeatureOff(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 404) return false;
  const { code } = extractApiError(err, '');
  return !code || !ERROR_CODES.includes(code);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `FLOW_INVALID` details: one issue per problem, by step. */
export function issuesOf(details: unknown[]): StepIssue[] {
  return details
    .filter((d): d is Record<string, unknown> => isObject(d) && typeof d.code === 'string')
    .map((d) => ({
      code: d.code as string,
      ...(typeof d.stepIndex === 'number' ? { stepIndex: d.stepIndex } : {}),
      ...(typeof d.stepKey === 'string' ? { stepKey: d.stepKey } : {}),
    }));
}

export interface InactiveTeamDetail {
  stepIndex: number;
  stepKey: string;
  teamId: string;
}

/** `TEAM_NOT_ACTIVE` details. */
export function inactiveTeamsOf(details: unknown[]): InactiveTeamDetail[] {
  return details
    .filter((d): d is Record<string, unknown> => isObject(d) && typeof d.teamId === 'string')
    .map((d) => ({
      stepIndex: typeof d.stepIndex === 'number' ? d.stepIndex : -1,
      stepKey: typeof d.stepKey === 'string' ? d.stepKey : '',
      teamId: d.teamId as string,
    }));
}

export interface BoundConflict {
  directoryId?: string;
  deadlineGroup?: string;
  flowId?: string;
  flowName?: string;
}

/** `TYPE_ALREADY_BOUND` details. */
export function boundConflictsOf(details: unknown[]): BoundConflict[] {
  return details.filter(isObject).map((d) => ({
    ...(typeof d.directoryId === 'string' ? { directoryId: d.directoryId } : {}),
    ...(typeof d.deadlineGroup === 'string' ? { deadlineGroup: d.deadlineGroup } : {}),
    ...(typeof d.flowId === 'string' ? { flowId: d.flowId } : {}),
    ...(typeof d.flowName === 'string' ? { flowName: d.flowName } : {}),
  }));
}

/** `STEPS_INVALID` details: where in the list a field was refused. */
export function shapeProblemsOf(details: unknown[]): Array<{ stepIndex?: number; field: string }> {
  return details
    .filter((d): d is Record<string, unknown> => isObject(d) && typeof d.field === 'string')
    .map((d) => ({ ...(typeof d.stepIndex === 'number' ? { stepIndex: d.stepIndex } : {}), field: d.field as string }));
}
