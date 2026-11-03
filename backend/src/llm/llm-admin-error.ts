import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable wire codes for LLM administration failures. The server sends the code, never display text:
 * the UI translates it, and a code can be tested for.
 */
export type LlmAdminErrorCode =
  | 'LLM_KEY_NOT_CONFIGURED'
  | 'LLM_PROVIDER_INVALID'
  | 'LLM_PROVIDER_NOT_FOUND'
  | 'LLM_PROVIDER_ARCHIVED'
  | 'LLM_PROVIDER_KIND_UNSUPPORTED'
  | 'LLM_PROVIDER_IN_USE'
  | 'LLM_ROLE_BLOCKED'
  | 'LLM_ASSESSMENT_INVALID'
  | 'LLM_ASSESSMENT_NOT_FOUND';

export class LlmAdminError extends HttpException {
  constructor(
    readonly adminCode: LlmAdminErrorCode,
    status: HttpStatus,
    details: Record<string, unknown> = {},
  ) {
    super({ code: adminCode, ...details }, status);
  }
}
