import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';

/**
 * GET /bao-cao-dong/clock — the client's single source of server time for
 * deadline countdowns (spec §4.2 "Trình duyệt có countdown theo server
 * time; job chỉ phục vụ thông báo/snapshot, không phải điều kiện duy nhất
 * để khóa"). Deliberately NOT behind PermissionsGuard: it returns nothing
 * about any specific report, period, or user — any authenticated user with
 * the module enabled may read it, same spirit as /health being public.
 */
@Controller('bao-cao-dong')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
@FeatureFlag('dynamic_reports')
export class ClockController {
  @Get('clock')
  getClock(): { serverTime: string } {
    return { serverTime: new Date().toISOString() };
  }
}
