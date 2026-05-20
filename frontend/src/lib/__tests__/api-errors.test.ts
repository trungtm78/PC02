/**
 * Regression test for the "Có lỗi xảy ra" toast bug.
 *
 * Backend wraps every error response as
 *   { success:false, error:{ code, message, details }, timestamp, path }
 * (see backend/src/common/filters/http-exception.filter.ts). Multiple frontend
 * pages used to read `data.message` directly and always fell through to a
 * generic toast, hiding the real error from the user.
 *
 * extractApiError() is the single source of truth for unpacking that envelope.
 */
import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { extractApiError } from '../api-errors';

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const err = new AxiosError('Request failed', String(status));
  err.response = {
    status,
    statusText: '',
    data,
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

describe('extractApiError — wrapped envelope (current backend)', () => {
  it('reads message from data.error.message', () => {
    const err = axiosErrorWith(409, {
      success: false,
      error: { code: 'CONFLICT', message: 'Hồ sơ đã được chỉnh sửa', details: [] },
    });
    const result = extractApiError(err);
    expect(result.message).toBe('Hồ sơ đã được chỉnh sửa');
    expect(result.messages).toEqual(['Hồ sơ đã được chỉnh sửa']);
    expect(result.code).toBe('CONFLICT');
    expect(result.status).toBe(409);
  });

  it('expands validation details[] into per-field messages', () => {
    const err = axiosErrorWith(400, {
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation failed',
        details: ['name should not be empty', 'fromDate must be a valid date string'],
      },
    });
    const result = extractApiError(err);
    expect(result.message).toBe('Validation failed');
    expect(result.messages).toEqual([
      'name should not be empty',
      'fromDate must be a valid date string',
    ]);
    expect(result.code).toBe('BAD_REQUEST');
  });

  it('falls back to the supplied default when message is missing', () => {
    const err = axiosErrorWith(500, { success: false, error: {} });
    const result = extractApiError(err, 'Lỗi khi xóa');
    expect(result.message).toBe('Lỗi khi xóa');
    expect(result.messages).toEqual(['Lỗi khi xóa']);
  });
});

describe('extractApiError — legacy NestJS shape', () => {
  it('handles message as string', () => {
    const err = axiosErrorWith(403, {
      statusCode: 403,
      message: 'Bạn không có quyền',
      error: 'Forbidden',
    });
    const result = extractApiError(err);
    expect(result.message).toBe('Bạn không có quyền');
  });

  it('handles message as string[]', () => {
    const err = axiosErrorWith(400, {
      statusCode: 400,
      message: ['fieldA is required', 'fieldB must be a string'],
    });
    const result = extractApiError(err);
    expect(result.messages).toEqual(['fieldA is required', 'fieldB must be a string']);
    expect(result.message).toBe('fieldA is required');
  });
});

describe('extractApiError — network and non-axios errors', () => {
  it('returns network message when there is no response', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    const result = extractApiError(err);
    expect(result.message).toMatch(/kết nối/i);
    expect(result.status).toBe(0);
  });

  it('returns plain Error message', () => {
    const result = extractApiError(new Error('Boom'));
    expect(result.message).toBe('Boom');
  });

  it('returns fallback for unknown error type', () => {
    const result = extractApiError('weird');
    expect(result.message).toBe('Có lỗi xảy ra');
  });
});
