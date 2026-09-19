import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './guards/feature-flag.guard';

@Global()
@Module({
  // KHÔNG đăng ký FeatureFlagGuard làm APP_GUARD: guard toàn cục chạy trước JwtAuthGuard nên không thấy user (19/09/2026).
  // Controller có @FeatureFlag khai @UseGuards(JwtAuthGuard, FeatureFlagGuard, ...).
  providers: [FeatureFlagsService, FeatureFlagGuard],
  controllers: [FeatureFlagsController],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
