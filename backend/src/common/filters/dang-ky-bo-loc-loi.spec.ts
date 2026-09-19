import {
  Controller,
  Get,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import type { Server } from 'http';
import { dangKyBoLocLoi } from './dang-ky-bo-loc-loi';

/**
 * Thứ tự bộ lọc lỗi toàn cục — kiểm ở TẦNG HTTP (app Nest thật, supertest), đăng ký qua CHÍNH hàm `main.ts` dùng.
 *
 * Lỗi sống trên prod tới 19/09/2026: `main.ts` gọi `useGlobalFilters(new PrismaExceptionFilter(), new
 * GlobalExceptionFilter())` với chú thích "Prisma đứng trước thì được xét trước". Nest làm NGƯỢC LẠI
 * (`router-exception-filters.js`: `filters.reverse()`) → bộ `@Catch()` bắt-tất-cả thắng → bộ lọc Prisma KHÔNG
 * BAO GIỜ chạy: trùng khoá (P2002), tham chiếu sai (P2003), không thấy bản ghi (P2025) đều thành 500 "Internal
 * server error" — cán bộ không biết phải sửa gì. Ca kiểm đơn vị của bộ lọc gọi thẳng `catch()` nên xanh suốt.
 */
const loiPrisma = (
  code: string,
  meta?: Record<string, unknown>,
  message = 'x',
) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7',
    meta,
  });

/**
 * `meta` ĐÚNG dạng Prisma 7 + @prisma/adapter-pg sinh ra (runtime `He()`: `{ driverAdapterError: e }`, client thêm
 * `modelName`; adapter-pg: `cause.constraint = { fields }` cho 23505/23502/23503, `cause.column` cho 22001).
 * Rà độc lập 19/09/2026: bản đầu dựng `meta: { constraint: [...] }` — dạng Prisma 7 không bao giờ sinh → ca xanh giả.
 */
const metaAdapter = (cause: Record<string, unknown>) => ({
  modelName: 'Case',
  driverAdapterError: { cause },
});

@Controller('thu')
class ThuController {
  @Get('p2002')
  trung() {
    throw loiPrisma(
      'P2002',
      metaAdapter({
        kind: 'UniqueConstraintViolation',
        constraint: { fields: ['caseCode'] },
      }),
    );
  }
  @Get('p2003')
  thamChieu() {
    throw loiPrisma('P2003');
  }
  @Get('p2025')
  khongThay() {
    throw loiPrisma(
      'P2025',
      undefined,
      'An operation failed because it depends on one or more records that were required but not found. No record was found for an update.',
    );
  }
  @Get('p2025-lien-ket')
  lienKetSai() {
    throw loiPrisma(
      'P2025',
      undefined,
      "An operation failed because it depends on one or more records that were required but not found. No 'Team' record (needed to inline the relation on 'Case' record(s)) was found for a nested connect on one-to-many relation 'CaseToTeam'.",
    );
  }
  @Get('p2011')
  thieuGiaTri() {
    throw loiPrisma(
      'P2011',
      metaAdapter({
        kind: 'NullConstraintViolation',
        constraint: { fields: ['name'] },
      }),
    );
  }
  @Get('p2000')
  quaDai() {
    throw loiPrisma(
      'P2000',
      metaAdapter({ kind: 'LengthMismatch', column: 'caseCode' }),
    );
  }
  @Get('http')
  http() {
    throw new NotFoundException('Không có hồ sơ');
  }
  @Get('loi-thuong')
  loiThuong() {
    throw new Error('hỏng');
  }
}

/** Thân phản hồi lỗi chuẩn của API. */
const than = (r: request.Response) =>
  r.body as {
    error: {
      code: string;
      message: string;
      details: string[];
      fields?: string[];
    };
  };

describe('dangKyBoLocLoi — bộ lọc Prisma THỰC SỰ chạy qua HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ThuController],
    }).compile();
    app = mod.createNestApplication({ logger: false });
    dangKyBoLocLoi(app);
    await app.init();
  });
  afterAll(() => app.close());

  const goi = (duong: string) =>
    request(app.getHttpServer() as Server).get(`/thu/${duong}`);

  it('P2002 trùng khoá → 409 DUPLICATE_VALUE (không phải 500)', async () => {
    const r = await goi('p2002');
    expect(r.status).toBe(409);
    expect(than(r).error.code).toBe('DUPLICATE_VALUE');
  });

  it('P2003 tham chiếu sai → 400 INVALID_REFERENCE', async () => {
    const r = await goi('p2003');
    expect(r.status).toBe(400);
    expect(than(r).error.code).toBe('INVALID_REFERENCE');
  });

  it('P2025 không thấy bản ghi → 404 RECORD_NOT_FOUND', async () => {
    const r = await goi('p2025');
    expect(r.status).toBe(404);
    expect(than(r).error.code).toBe('RECORD_NOT_FOUND');
  });

  it('P2002 nêu trường trùng ở `fields` (lấy từ meta thật của adapter); `details` giữ rỗng — giao diện hiện details thành lời báo lỗi', async () => {
    const r = than(await goi('p2002'));
    expect(r.error.fields).toEqual(['caseCode']);
    expect(r.error.details).toEqual([]);
  });

  it('P2025 do liên kết (connect) tới bản ghi không tồn tại → 400 INVALID_REFERENCE, không phải 404', async () => {
    const r = await goi('p2025-lien-ket');
    expect(r.status).toBe(400);
    expect(than(r).error.code).toBe('INVALID_REFERENCE');
  });

  it('P2000 giá trị quá dài → 400 VALUE_TOO_LONG, nêu cột', async () => {
    const r = await goi('p2000');
    expect(r.status).toBe(400);
    expect(than(r).error.code).toBe('VALUE_TOO_LONG');
    expect(than(r).error.fields).toEqual(['caseCode']);
  });

  it('P2011 thiếu giá trị bắt buộc → 400 MISSING_REQUIRED_VALUE, nêu trường', async () => {
    const r = await goi('p2011');
    expect(r.status).toBe(400);
    expect(than(r).error.code).toBe('MISSING_REQUIRED_VALUE');
    expect(than(r).error.fields).toEqual(['name']);
  });

  it('HttpException vẫn qua bộ lọc chung, giữ status và lời', async () => {
    const r = await goi('http');
    expect(r.status).toBe(404);
    expect(than(r).error.message).toBe('Không có hồ sơ');
  });

  it('lỗi thường vẫn 500 INTERNAL_ERROR, không lộ chi tiết', async () => {
    const r = await goi('loi-thuong');
    expect(r.status).toBe(500);
    expect(than(r).error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(than(r))).not.toContain('hỏng');
  });
});
