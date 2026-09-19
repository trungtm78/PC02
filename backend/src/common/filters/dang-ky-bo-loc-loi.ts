import type { INestApplication } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';
import { PrismaExceptionFilter } from './prisma-exception.filter';

/**
 * Đăng ký bộ lọc lỗi toàn cục — MỘT chỗ, `main.ts` và ca kiểm tầng HTTP cùng gọi.
 *
 * Nest xét bộ lọc toàn cục theo thứ tự NGƯỢC với lúc đăng ký (`router-exception-filters.js`: `filters.reverse()`),
 * và dừng ở bộ đầu tiên khớp kiểu lỗi. Bộ `@Catch()` bắt-tất-cả vì thế phải đăng ký TRƯỚC, bộ chuyên biệt đăng ký
 * SAU. Tới 19/09/2026 `main.ts` làm ngược (kèm chú thích nói ngược) → bộ lọc Prisma không bao giờ chạy, mọi lỗi
 * trùng khoá / tham chiếu sai / không thấy bản ghi đều thành 500.
 */
export function dangKyBoLocLoi(app: INestApplication): void {
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
  );
}
