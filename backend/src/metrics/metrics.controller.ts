import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Sprint 3 / S3.3 — GET /api/v1/metrics exposes Prometheus exposition format.
 *
 * KHÔNG gated bởi JwtAuthGuard — Prometheus scrape job dùng IP allowlist tại
 * nginx level (chỉ 127.0.0.1 từ Prometheus container trong cùng VM được phép).
 *
 * Production nginx config phải block external access:
 *   location = /api/v1/metrics {
 *     allow 127.0.0.1;
 *     deny all;
 *     proxy_pass http://127.0.0.1:3000;
 *   }
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.getContentType());
    res.send(await this.metrics.getMetrics());
  }
}
