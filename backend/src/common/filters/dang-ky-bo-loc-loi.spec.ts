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
const loiPrisma = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('x', {
    code,
    clientVersion: '7',
    meta,
  });

@Controller('thu')
class ThuController {
  @Get('p2002')
  trung() {
    throw loiPrisma('P2002', { target: ['caseCode'] });
  }
  @Get('p2003')
  thamChieu() {
    throw loiPrisma('P2003');
  }
  @Get('p2025')
  khongThay() {
    throw loiPrisma('P2025');
  }
  @Get('p2011')
  thieuGiaTri() {
    throw loiPrisma('P2011', { constraint: ['name'] });
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
    error: { code: string; message: string; details: string[] };
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

  it('P2011 thiếu giá trị bắt buộc → 400 MISSING_REQUIRED_VALUE, nêu trường', async () => {
    const r = await goi('p2011');
    expect(r.status).toBe(400);
    expect(than(r).error.code).toBe('MISSING_REQUIRED_VALUE');
    expect(than(r).error.details).toEqual(['name']);
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
