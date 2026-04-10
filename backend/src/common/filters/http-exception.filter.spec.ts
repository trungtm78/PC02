import { GlobalExceptionFilter } from './http-exception.filter';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest.fn().mockReturnValue({ url: '/api/v1/test' });
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format HttpException with correct status and message', () => {
    const exception = new NotFoundException('User not found');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'User not found',
          details: [],
        }),
        path: '/api/v1/test',
      }),
    );
    // Verify timestamp is an ISO string
    const response = mockJson.mock.calls[0][0];
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });

  it('should handle unknown exceptions as 500 Internal Server Error', () => {
    const exception = new Error('Something broke');

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: [],
        }),
      }),
    );
  });

  it('should preserve validation error details from ValidationPipe', () => {
    // ValidationPipe throws BadRequestException with message array
    const exception = new BadRequestException({
      message: ['email must be an email', 'password is too short'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'BAD_REQUEST',
          message: 'Validation failed',
          details: ['email must be an email', 'password is too short'],
        }),
      }),
    );
  });

  it('should include timestamp and path in response', () => {
    const before = new Date().toISOString();
    filter.catch(new HttpException('test', 400), mockHost);
    const after = new Date().toISOString();

    const response = mockJson.mock.calls[0][0];
    expect(response.timestamp).toBeDefined();
    expect(response.timestamp >= before).toBe(true);
    expect(response.timestamp <= after).toBe(true);
    expect(response.path).toBe('/api/v1/test');
  });
});
