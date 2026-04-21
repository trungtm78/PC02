import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:5179'];
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`PC02 Backend running on http://localhost:${port}`);
}

void bootstrap();
