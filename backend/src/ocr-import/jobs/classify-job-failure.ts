import { LlmExhaustedError } from '../../llm/call-policy';
import { LlmAdminError } from '../../llm/llm-admin-error';
import { LlmError } from '../../llm/llm.types';
import { OcrImportError } from '../ocr-import-error';

export interface JobFailure {
  /** A stable code, safe to store and show: never a message, which could carry personal data. */
  code: string;
  retryable: boolean;
}

/**
 * Decides what a failed job records and whether the queue should try it again.
 *
 * Rules of the intake and of administration (a closed session, no provider, a spent quota) are final: running the
 * same work again cannot change them. A provider failure keeps its own verdict, because the gateway has already
 * retried and failed over; the job-level retry is for outages that outlast those short retries.
 */
export function classifyJobFailure(error: unknown): JobFailure {
  if (error instanceof OcrImportError) {
    return { code: error.ocrCode, retryable: false };
  }
  if (error instanceof LlmAdminError) {
    return { code: error.adminCode, retryable: false };
  }
  if (error instanceof LlmExhaustedError) {
    return error.lastError
      ? { code: error.lastError.code, retryable: error.lastError.retryable }
      : { code: 'LLM_EXHAUSTED', retryable: false };
  }
  if (error instanceof LlmError) {
    return { code: error.code, retryable: error.retryable };
  }
  return { code: 'INTERNAL', retryable: true };
}
