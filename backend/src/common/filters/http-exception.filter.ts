import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      code = HttpStatus[status] || 'UNKNOWN_ERROR';

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || exception.message;

        // Giữ MÃ MÁY-ĐỌC-ĐƯỢC do nơi ném đặt riêng, ví dụ `FEATURE_DISABLED`.
        //
        // Vì sao cần: `code` mặc định lấy từ `HttpStatus[status]`, nên một tính
        // năng bị tắt và một bản ghi không tồn tại đều ra `NOT_FOUND`. Web
        // (`lib/api.ts`) và mobile (`api_client.dart`) đều rẽ nhánh theo
        // `FEATURE_DISABLED` để nói "tính năng đang tắt" thay vì hiện lỗi chung
        // — mã bị nuốt thì app đã cài hiển thị `Lỗi: DioException ... 404` cho
        // cán bộ không làm gì sai.
        //
        // Chỉ nhận dạng UPPER_SNAKE: ngoại lệ mặc định của Nest cũng có trường
        // `error`, nhưng là văn xuôi (`'Not Found'`, `'Unauthorized'`). Lấy bừa
        // sẽ đổi `code` của MỌI lỗi sẵn có từ `NOT_FOUND` thành `Not Found` và
        // phá hợp đồng mà client đang dựa vào.
        if (
          typeof res.error === 'string' &&
          /^[A-Z][A-Z0-9_]*$/.test(res.error)
        ) {
          code = res.error;
        }

        // Preserve validation error details from ValidationPipe
        if (Array.isArray(res.message)) {
          details = res.message;
          message = 'Validation failed';
        }
      }
    }

    // P1-004: log stack trace server-side for ALL non-HttpException + HttpException 5xx.
    // Stack NEVER leaked to client (response shape unchanged). Cause chain walked.
    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error(
        'Unhandled exception',
        this.formatErrorWithCauseChain(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Format error for logging with full cause chain (Error.cause).
   * Walks recursively until cause is undefined or non-Error.
   * Handles non-Error throws (string/number/object) by stringifying.
   */
  private formatErrorWithCauseChain(exception: unknown): string {
    const parts: string[] = [];
    let current: unknown = exception;
    let depth = 0;
    const MAX_DEPTH = 10; // guard against circular cause chains

    while (current !== undefined && current !== null && depth < MAX_DEPTH) {
      const prefix = depth === 0 ? '' : `Caused by: `;
      if (current instanceof Error) {
        parts.push(
          `${prefix}${current.stack ?? `${current.name}: ${current.message}`}`,
        );
        current = (current as Error & { cause?: unknown }).cause;
      } else {
        parts.push(`${prefix}${String(current)}`);
        break;
      }
      depth++;
    }

    return parts.join('\n');
  }
}
