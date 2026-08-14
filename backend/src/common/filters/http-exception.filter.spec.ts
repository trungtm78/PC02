import { GlobalExceptionFilter } from './http-exception.filter';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
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

  // ── P1-004 — Logging server-side stack trace for non-HttpException + 500s ──
  describe('logging (P1-004)', () => {
    let loggerErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it('logs stack trace for non-HttpException (raw Error)', () => {
      const exception = new Error('Database connection lost');
      filter.catch(exception, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const [message, stack] = loggerErrorSpy.mock.calls[0];
      expect(String(message)).toMatch(/unhandled|exception/i);
      expect(String(stack)).toContain('Database connection lost');
    });

    it('logs stack for HttpException status >= 500', () => {
      const exception = new InternalServerErrorException('cache miss');
      filter.catch(exception, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT log for HttpException status < 500 (NotFound)', () => {
      filter.catch(new NotFoundException('x'), mockHost);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('does NOT log for HttpException status < 500 (BadRequest)', () => {
      filter.catch(new BadRequestException('x'), mockHost);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('walks Error.cause chain and logs all causes (per ENG-4)', () => {
      const root = new Error('root cause leaf');
      const wrapped = new Error('wrapped middle', { cause: root });
      filter.catch(wrapped, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalled();
      const allArgs = loggerErrorSpy.mock.calls.flat().map(String).join(' ');
      expect(allArgs).toContain('root cause leaf');
      expect(allArgs).toContain('wrapped middle');
    });

    it('keeps stack server-side only — does NOT leak to client response (per CEO-7)', () => {
      const exception = new Error('sensitive internal detail');
      filter.catch(exception, mockHost);
      const response = mockJson.mock.calls[0][0];
      const responseStr = JSON.stringify(response);
      expect(responseStr).not.toContain('sensitive internal detail');
      expect(responseStr).not.toMatch(/at\s+\w+\s+\(.+:\d+:\d+\)/);
    });

    it('logs non-Error throws (string) safely without crash', () => {
      filter.catch('something threw a string', mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const allArgs = loggerErrorSpy.mock.calls.flat().map(String).join(' ');
      expect(allArgs).toContain('something threw a string');
    });
  });
});

describe('mã máy-đọc-được do nơi ném đặt riêng', () => {
  /**
   * `code` mặc định lấy từ `HttpStatus[status]`, nên "tính năng bị tắt" và
   * "không tìm thấy bản ghi" đều ra `NOT_FOUND`. Web và mobile đều rẽ nhánh
   * theo `FEATURE_DISABLED`; mã bị nuốt thì app đã cài hiện lỗi chung.
   *
   * Lỗi này vô hình suốt thời gian dài vì gate cờ chưa bao giờ chạy tới đây
   * (ADR-0018) — sửa xong lỗi thứ nhất mới lộ ra lỗi thứ hai.
   */
  it('giữ FEATURE_DISABLED thay vì ghi đè bằng NOT_FOUND', () => {
    const filter = new GlobalExceptionFilter();
    const json = jest.fn();
    const host = makeHost(json);

    filter.catch(
      new NotFoundException({
        statusCode: 404,
        error: 'FEATURE_DISABLED',
        feature: 'lawyers',
        message: 'Tính năng "Luật sư" hiện đang tắt',
      }),
      host,
    );

    expect(json.mock.calls[0][0].error.code).toBe('FEATURE_DISABLED');
    expect(json.mock.calls[0][0].error.message).toContain('Luật sư');
  });

  it('KHÔNG lấy trường `error` văn xuôi của ngoại lệ Nest mặc định', () => {
    // `new NotFoundException('msg')` sinh ra `{ error: 'Not Found' }`. Lấy bừa
    // sẽ đổi `code` của mọi lỗi sẵn có và phá hợp đồng client đang dựa vào.
    const filter = new GlobalExceptionFilter();
    const json = jest.fn();
    const host = makeHost(json);

    filter.catch(new NotFoundException('Không tìm thấy hồ sơ'), host);

    expect(json.mock.calls[0][0].error.code).toBe('NOT_FOUND');
  });

  function makeHost(json: jest.Mock) {
    const status = jest.fn(() => ({ json }));
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/v1/lawyers' }),
      }),
    } as never;
  }
});
