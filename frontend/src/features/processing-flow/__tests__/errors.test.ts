import { describe, it, expect } from 'vitest';
import { explainError, isFeatureOff } from '../errors';
import { processingFlow } from '@/locales/processingFlow.vi';

/** An axios error as the server's exception filter shapes it: `{ success:false, code, error:{ code, message, details } }`. */
function serverError(status: number, code: string | null, details: unknown[] = []) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: code === null ? { statusCode: status, message: 'Cannot GET /api/v1/processing-flows', error: 'Not Found' } : { success: false, code, error: { code, message: code, details } },
    },
  };
}

describe('explaining a refused request', () => {
  it('turns the code into the sentence and keeps the details as they came', () => {
    const e = explainError(serverError(409, 'TYPE_ALREADY_BOUND', [{ directoryId: 'd1', flowId: 'f2', flowName: 'Tố cáo' }]));
    expect(e.code).toBe('TYPE_ALREADY_BOUND');
    expect(e.message).toBe(processingFlow.errors.TYPE_ALREADY_BOUND);
    expect(e.details).toEqual([{ directoryId: 'd1', flowId: 'f2', flowName: 'Tố cáo' }]);
    expect(e.conflict).toBe(false);
  });

  it('REVISION_CONFLICT is flagged as a conflict so the screen offers a reload', () => {
    const e = explainError(serverError(409, 'REVISION_CONFLICT'));
    expect(e.conflict).toBe(true);
    expect(e.message).toBe(processingFlow.errors.REVISION_CONFLICT);
  });

  it('a 400 with no code (a wrong type, a missing expectedRevision) never shows the raw server text as a code', () => {
    const e = explainError({ isAxiosError: true, response: { status: 400, data: { success: false, error: { code: 'BAD_REQUEST', message: 'Validation failed', details: ['expectedRevision must be an integer'] } } } });
    expect(e.code).toBe('BAD_REQUEST');
    expect(e.message).not.toBe('BAD_REQUEST');
  });

  it('a network failure has no code and says so in the server-less words', () => {
    const e = explainError({ isAxiosError: true, response: undefined });
    expect(e.code).toBeUndefined();
    expect(e.message.length).toBeGreaterThan(5);
  });
});

describe('the feature switch being off', () => {
  it('is a 404 that carries none of the contract codes', () => {
    expect(isFeatureOff(serverError(404, null))).toBe(true);
    expect(isFeatureOff(serverError(404, 'NOT_FOUND'))).toBe(true);
  });

  it('a 404 that carries a contract code (the flow is gone) is NOT the switch', () => {
    expect(isFeatureOff(serverError(404, 'FLOW_NOT_FOUND'))).toBe(false);
    expect(isFeatureOff(serverError(404, 'CALENDAR_YEAR_NOT_FOUND'))).toBe(false);
  });

  it('other statuses are not the switch', () => {
    expect(isFeatureOff(serverError(403, 'FORBIDDEN'))).toBe(false);
    expect(isFeatureOff(serverError(500, null))).toBe(false);
    expect(isFeatureOff(new Error('x'))).toBe(false);
  });
});
