import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Prisma } from '@prisma/client';

/**
 * UAT Round 1 (TC-484, TC-485, TC-507, TC-622): Centralized Prisma error handling.
 *
 * Bắt Prisma.PrismaClientKnownRequestError trước khi bubble lên GlobalExceptionFilter,
 * map sang HTTP status có ý nghĩa:
 *   P2003 (FK violation)        → 400 INVALID_REFERENCE
 *   P2002 (unique violation)    → 409 DUPLICATE_VALUE
 *   P2025 (record not found)    → 404 RECORD_NOT_FOUND
 *   khác                        → 500 DATABASE_ERROR (log đầy đủ server-side)
 *
 * Phải register TRƯỚC GlobalExceptionFilter trong main.ts để NestJS resolve
 * specific filter trước catch-all (LIFO bubble order).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: string;
    let message: string;

    switch (exception.code) {
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_REFERENCE';
        message = 'Tham chiếu không hợp lệ — bản ghi liên quan không tồn tại';
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_VALUE';
        message = 'Giá trị đã tồn tại — không thể trùng';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        code = 'RECORD_NOT_FOUND';
        message = 'Bản ghi không tồn tại hoặc đã bị xóa';
        break;
      default:
        this.logger.error(
          `Unhandled Prisma error ${exception.code}`,
          exception.stack,
        );
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'DATABASE_ERROR';
        message = 'Lỗi cơ sở dữ liệu';
    }

    response.status(status).json({
      success: false,
      error: { code, message, details: [] },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
