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
 *   P2011/P2012 (thiếu giá trị bắt buộc) → 400 MISSING_REQUIRED_VALUE
 *   P2000 (giá trị quá dài)     → 400 VALUE_TOO_LONG
 * `error.fields` = tên trường gây lỗi (khi adapter bóc được), `error.details` giữ rỗng.
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
    // Tên trường gây lỗi — khoá RIÊNG, không nhét vào `details`: giao diện hiện `details` thành từng dòng lời báo
    // lỗi (class-validator), tên cột thô "caseCode" hiện lên form là vô nghĩa với cán bộ.
    let fields: string[] = [];

    switch (exception.code) {
      case 'P2011':
      case 'P2012':
        status = HttpStatus.BAD_REQUEST;
        code = 'MISSING_REQUIRED_VALUE';
        message = 'Thiếu giá trị bắt buộc';
        fields = truongTrongMeta(exception.meta);
        break;
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        code = 'VALUE_TOO_LONG';
        message = 'Giá trị quá dài so với giới hạn của trường';
        fields = truongTrongMeta(exception.meta);
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_REFERENCE';
        message = 'Tham chiếu không hợp lệ — bản ghi liên quan không tồn tại';
        fields = truongTrongMeta(exception.meta);
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_VALUE';
        message = 'Giá trị đã tồn tại — không thể trùng';
        fields = truongTrongMeta(exception.meta);
        break;
      case 'P2025':
        // Hai nghĩa: sửa/xoá bản ghi không còn (404) — hay LIÊN KẾT (connect) tới id không tồn tại, tức tham
        // chiếu sai trong dữ liệu gửi lên (400). Runtime Prisma 7 chỉ phân biệt ở lời lỗi (MISSING_RELATED_RECORD
        // / INCOMPLETE_CONNECT_INPUT nói tới "relation" / "to be connected").
        if (/relation '|to be connected/.test(exception.message)) {
          status = HttpStatus.BAD_REQUEST;
          code = 'INVALID_REFERENCE';
          message = 'Tham chiếu không hợp lệ — bản ghi liên quan không tồn tại';
        } else {
          status = HttpStatus.NOT_FOUND;
          code = 'RECORD_NOT_FOUND';
          message = 'Bản ghi không tồn tại hoặc đã bị xóa';
        }
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

    // Lỗi dữ liệu lọt tới đây thường là lỗi của chính backend (gán sai khoá ngoại, quên cột bắt buộc) — trước
    // 19/09/2026 chúng rơi vào bộ bắt-tất-cả và được ghi nhật ký; giữ dấu vết ấy (không cần stack).
    if (status < 500) {
      this.logger.warn(
        `${exception.code} ${request.method} ${request.url} → ${status} ${JSON.stringify(exception.meta?.driverAdapterError ?? exception.meta ?? {})}`,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message, details: [], fields },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

/**
 * Tên trường gây lỗi. Prisma 7 + @prisma/adapter-pg đặt nó ở `meta.driverAdapterError.cause`:
 * `constraint.fields` (trùng / thiếu / khoá ngoại) hoặc `column` (quá dài). Adapter chỉ bóc được khi Postgres gửi
 * chi tiết — không có thì rỗng (không đoán). Khoá tầng trên (`target`…) giữ cho trình điều khiển khác.
 */
function truongTrongMeta(meta: Record<string, unknown> | undefined): string[] {
  const cause = (
    meta?.driverAdapterError as { cause?: Record<string, unknown> } | undefined
  )?.cause;
  const rangBuoc = cause?.constraint as { fields?: unknown } | undefined;
  const nguon: Record<string, unknown> = {
    fields: rangBuoc?.fields,
    column: cause?.column,
    ...meta,
  };
  for (const khoa of [
    'fields',
    'column',
    'target',
    'constraint',
    'column_name',
  ]) {
    const v = nguon[khoa];
    if (typeof v === 'string' && v) return [v];
    if (Array.isArray(v)) {
      const ds = v.filter((x): x is string => typeof x === 'string');
      if (ds.length) return ds;
    }
  }
  return [];
}
