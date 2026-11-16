import { BadRequestException, ConflictException, type ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from '../common/filters/http-exception.filter';
import { WARD_ERROR } from './ward-assignment.codes';
import { sameStamp, wardBody } from './ward-errors';

/** What the client receives for an exception, through the real global filter (the HTTP boundary). */
function sent(exception: unknown): { status: number; body: Record<string, unknown> } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ url: '/api/v1/ward-assignments/x/submit' }) }),
  } as unknown as ArgumentsHost;
  new GlobalExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
}

describe('errors of the ward assignment requests at the HTTP boundary', () => {
  it('what is missing before submitting reaches the client, field by field, next to the code', () => {
    const { status, body } = sent(new BadRequestException(wardBody(WARD_ERROR.INCOMPLETE, { field: 'summary' }, { field: 'subjects' })));
    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain(WARD_ERROR.INCOMPLETE);
    expect(body).toMatchObject({ error: { details: [{ field: 'summary' }, { field: 'subjects' }] } });
  });

  it('a conflict carries the stamp now stored', () => {
    const { body } = sent(new ConflictException(wardBody(WARD_ERROR.CONFLICT, { updatedAt: '2026-11-16T10:00:00.000Z' })));
    expect(body).toMatchObject({ error: { details: [{ updatedAt: '2026-11-16T10:00:00.000Z' }] } });
  });
});

describe('comparing the stamp of the form with the stored one', () => {
  const stored = new Date('2026-11-16T10:00:00.123Z');

  it('the same instant, however it is written, is the same form; another instant is not', () => {
    expect(sameStamp(stored, '2026-11-16T10:00:00.123Z')).toBe(true);
    expect(sameStamp(stored, '2026-11-16T17:00:00.123+07:00')).toBe(true);
    expect(sameStamp(stored, '2026-11-16T10:00:00.124Z')).toBe(false);
  });

  it('a value that is not an instant with its offset is refused, never compared', () => {
    for (const bad of ['2026-W47-1', '2026-11-16', '2026-11-16T10:00:00', 'yesterday', '']) {
      expect(() => sameStamp(stored, bad)).toThrow(expect.objectContaining({ response: { code: WARD_ERROR.STAMP_INVALID, details: [] } }) as Error);
    }
  });
});
