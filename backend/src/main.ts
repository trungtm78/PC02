import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  // Global exception filter — standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CORS: env CORS_ORIGIN overrides localhost defaults (required for production)
  const rawOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const corsOrigins = rawOrigins.length > 0 ? rawOrigins : ['http://localhost:5173', 'http://localhost:5179', 'http://localhost:8080'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PC02 Backend running on http://localhost:${port}`);
}

void bootstrap();
