/** Turns a refused request of the ward assignment screens into words. The server sends CODES; the sentence is ours. */
import axios from 'axios';
import { wardAssignments as L, wardMissingField } from '@/locales/wardAssignments.vi';

export const WARD_CONFLICT_CODES = new Set(['WARD_ASSIGNMENT_CHANGED', 'WARD_ASSIGNMENT_STAMP_INVALID', 'WARD_INVESTIGATOR_CHANGED']);

export interface WardExplainedError {
  status?: number;
  code?: string;
  message: string;
  /** Somebody else changed the record meanwhile: the way forward is to load it again. */
  conflict: boolean;
  /** `WARD_ASSIGNMENT_INCOMPLETE`: the labels of the fields still missing. */
  missing: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function explainWardError(err: unknown): WardExplainedError {
  if (!axios.isAxiosError(err)) return { message: L.unknownError, conflict: false, missing: [] };
  if (!err.response) return { status: 0, message: L.networkError, conflict: false, missing: [] };
  const body = err.response.data as { code?: unknown; error?: { code?: unknown; details?: unknown } } | undefined;
  const rawCode = body?.error?.code ?? body?.code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const details = Array.isArray(body?.error?.details) ? (body?.error?.details as unknown[]) : [];
  const missing =
    code === 'WARD_ASSIGNMENT_INCOMPLETE'
      ? details.filter(isObject).map((d) => (typeof d.field === 'string' ? wardMissingField[d.field] ?? d.field : '')).filter(Boolean)
      : [];
  return {
    status: err.response.status,
    code,
    message: (code && L.errors[code]) || L.unknownError,
    conflict: !!code && WARD_CONFLICT_CODES.has(code),
    missing,
  };
}
