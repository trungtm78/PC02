import { HttpStatus } from '@nestjs/common';
import { LlmExhaustedError } from '../../llm/call-policy';
import { LlmAdminError } from '../../llm/llm-admin-error';
import { LlmError } from '../../llm/llm.types';
import { OcrImportError } from '../ocr-import-error';
import { classifyJobFailure } from './classify-job-failure';

describe('classifyJobFailure', () => {
  it('a rule of the intake itself is final: retrying cannot change it', () => {
    expect(
      classifyJobFailure(
        new OcrImportError('OCR_NO_PAGES', HttpStatus.CONFLICT),
      ),
    ).toEqual({ code: 'OCR_NO_PAGES', retryable: false });
  });

  it('a quota, budget or missing provider needs an administrator, so it is final', () => {
    for (const code of [
      'LLM_QUOTA_EXCEEDED',
      'LLM_BUDGET_EXHAUSTED',
      'LLM_NO_PROVIDER',
    ] as const) {
      expect(
        classifyJobFailure(
          new LlmAdminError(code, HttpStatus.TOO_MANY_REQUESTS),
        ),
      ).toEqual({ code, retryable: false });
    }
  });

  it('when every provider failed, the last failure decides whether trying later can help', () => {
    const overloaded = new LlmError('SERVER', 'overloaded', {
      retryable: true,
    });
    const rejected = new LlmError('BAD_REQUEST', 'bad', { retryable: false });
    expect(classifyJobFailure(new LlmExhaustedError([], overloaded))).toEqual({
      code: 'SERVER',
      retryable: true,
    });
    expect(classifyJobFailure(new LlmExhaustedError([], rejected))).toEqual({
      code: 'BAD_REQUEST',
      retryable: false,
    });
    expect(classifyJobFailure(new LlmExhaustedError([], null))).toEqual({
      code: 'LLM_EXHAUSTED',
      retryable: false,
    });
  });

  it('a single provider failure keeps its own code and retry flag', () => {
    expect(
      classifyJobFailure(new LlmError('TIMEOUT', 'slow', { retryable: true })),
    ).toEqual({ code: 'TIMEOUT', retryable: true });
  });

  it('anything unexpected is retried within the attempt limit, and never leaks its message', () => {
    const result = classifyJobFailure(
      new Error('secret: Nguyễn Văn A 0790123'),
    );
    expect(result).toEqual({ code: 'INTERNAL', retryable: true });
  });
});
