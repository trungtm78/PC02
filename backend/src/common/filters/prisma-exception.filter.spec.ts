import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

/**
 * TDD spec cho PrismaExceptionFilter (UAT Round 1).
 * Filter map Prisma errors → HTTP response chuẩn:
 *   P2003 (FK violation) → 400 INVALID_REFERENCE
 *   P2002 (unique violation) → 409 DUPLICATE_VALUE
 *   P2025 (record not found) → 404 RECORD_NOT_FOUND
 *   Other Prisma errors → 500 DATABASE_ERROR (logged server-side)
 */
describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/api/v1/test' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('maps P2003 (FK violation) → 400 INVALID_REFERENCE', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'FK constraint failed',
      { code: 'P2003', clientVersion: '7.8.0' },
    );
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_REFERENCE');
    expect(body.error.message).toContain('Tham chiếu không hợp lệ');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/v1/test');
  });

  it('maps P2002 (unique violation) → 409 DUPLICATE_VALUE', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.8.0' },
    );
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json.mock.calls[0][0].error.code).toBe('DUPLICATE_VALUE');
  });

  it('maps P2025 (record not found) → 404 RECORD_NOT_FOUND', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Record to update not found',
      { code: 'P2025', clientVersion: '7.8.0' },
    );
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json.mock.calls[0][0].error.code).toBe('RECORD_NOT_FOUND');
  });

  it('unknown Prisma code (e.g. P9999) → 500 DATABASE_ERROR', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Unknown error',
      { code: 'P9999', clientVersion: '7.8.0' },
    );
    filter.catch(err, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json.mock.calls[0][0].error.code).toBe('DATABASE_ERROR');
  });

  it('response shape matches GlobalExceptionFilter (success/error/timestamp/path)', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'test',
      { code: 'P2003', clientVersion: '7.8.0' },
    );
    filter.catch(err, mockHost);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error.code');
    expect(body).toHaveProperty('error.message');
    expect(body).toHaveProperty('error.details');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('path');
  });
});
