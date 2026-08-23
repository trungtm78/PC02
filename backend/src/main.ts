import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // v0.33.0.0: enable Nest DI for class-validator constraints (cho IsWardDirectory)
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Trust the first proxy hop (Render/nginx) so req.ip reflects real client IP in audit logs
  app.set('trust proxy', 1);

  // Security headers: nosniff, X-Frame-Options DENY, Referrer-Policy, HSTS (TLS-only env).
  // CSP disabled here — frontend is served by nginx, not the API; API responses are JSON +
  // file streams. Content-Disposition: attachment is set per-download in the controller.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    }),
  );

  // Global API prefix — all resource controllers use relative paths
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filters — standardized error responses.
  // NestJS áp bộ lọc theo thứ tự NGƯỢC với lúc đăng ký: bộ đăng ký SAU được xét TRƯỚC.
  // BUG-001 (UAT 2026-08-23): trước đây GlobalExceptionFilter (@Catch() bắt-tất-cả)
  // đăng ký sau nên luôn thắng → PrismaExceptionFilter thành mã chết, mọi lỗi Prisma
  // rơi xuống 500. Đặt bộ bắt-tất-cả TRƯỚC để bộ chuyên biệt được xét trước.
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
  );

  // CORS: env CORS_ORIGIN overrides localhost defaults (required for production)
  const rawOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsOrigins =
    rawOrigins.length > 0
      ? rawOrigins
      : [
          'http://localhost:5173',
          'http://localhost:5179',
          'http://localhost:8080',
        ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    // Header tải file cần expose để FE đọc cross-origin (dev :5173→:3000). Content-Disposition
    // cho filename; X-Batch-* cho kết quả in đồng loạt (Total/Ok/Failed đếm theo SỐ FILE
    // = N hồ sơ × M mẫu; X-Batch-Records là số hồ sơ, để FE hiển thị đúng "x file / y hồ sơ").
    exposedHeaders: [
      'Content-Disposition',
      'X-Batch-Total',
      'X-Batch-Ok',
      'X-Batch-Failed',
      'X-Batch-Records',
    ],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PC02 Backend running on http://localhost:${port}`);
}

void bootstrap();
