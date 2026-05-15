import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Sprint 3 / S3.3 — Global module: MetricsService available cho mọi feature
 * service inject mà không cần re-import. Reduces friction tăng counter từ
 * auth.service, scope-filter.util, audit.service, two-fa.service.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
