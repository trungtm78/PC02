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
 *   P2011/P2012 (thiếu giá trị bắt buộc) → 400 MISSING_REQUIRED_VALUE, `details` = tên trường
 *   P2000 (giá trị quá dài)     → 400 VALUE_TOO_LONG, `details` = tên cột
 *
 * Thứ tự đăng ký: xem `dang-ky-bo-loc-loi.ts` — bộ này phải đăng ký SAU bộ bắt-tất-cả (Nest xét ngược).
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
    let details: string[] = [];

    switch (exception.code) {
      case 'P2011':
      case 'P2012':
        status = HttpStatus.BAD_REQUEST;
        code = 'MISSING_REQUIRED_VALUE';
        message = 'Thiếu giá trị bắt buộc';
        details = truongTrongMeta(exception.meta);
        break;
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        code = 'VALUE_TOO_LONG';
        message = 'Giá trị quá dài so với giới hạn của trường';
        details = truongTrongMeta(exception.meta);
        break;
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
      error: { code, message, details },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

/**
 * Tên trường trong `meta` của lỗi Prisma — khoá tuỳ mã lỗi và trình điều khiển (`constraint`, `target`,
 * `column_name`, `path`). Chỉ nhận chuỗi / mảng chuỗi; không có thì rỗng (không đoán).
 */
function truongTrongMeta(meta: Record<string, unknown> | undefined): string[] {
  for (const khoa of ['constraint', 'target', 'column_name', 'path']) {
    const v = meta?.[khoa];
    if (typeof v === 'string' && v) return [v];
    if (Array.isArray(v)) {
      const ds = v.filter((x): x is string => typeof x === 'string');
      if (ds.length) return ds;
    }
  }
  return [];
}
