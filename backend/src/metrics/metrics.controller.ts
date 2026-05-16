import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';
import { MetricsIpAllowlistGuard } from './metrics.guard';

/**
 * Sprint 3 / S3.3 — GET /api/v1/metrics exposes Prometheus exposition format.
 *
 * Two-layer protection:
 *   1. Application-level: MetricsIpAllowlistGuard (defense-in-depth).
 *   2. nginx-level: `location = /api/v1/metrics { allow 127.0.0.1; deny all; }`
 *      trong scripts/deploy/nginx-pc02.conf.
 *
 * Hotfix history: Sprint 3 chỉ có nginx-level guard. Prod ship 2026-05-15 có
 * exposure window đến khi anh apply nginx config — guard này đóng gap đó.
 */
@Controller('metrics')
@UseGuards(MetricsIpAllowlistGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.getContentType());
    res.send(await this.metrics.getMetrics());
  }
}
