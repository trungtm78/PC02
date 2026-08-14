import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { FeatureFlagsService, FeatureFlagDto } from './feature-flags.service';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

/**
 * NOTE — do not move `@RequirePermissions` up to the class.
 *
 * `GET /feature-flags` is called by every authenticated user on every page
 * load: it is what builds the sidebar. A class-level permission would mean
 * anyone without `read:FeatureFlag` gets an empty menu and concludes the
 * system is broken. The permission belongs on the write routes only, which is
 * why `PermissionsGuard` sits at the class level but the decorator does not.
 */
@Controller('feature-flags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlags: FeatureFlagsService) {}

  /**
   * Return all feature flags visible to the current build pack.
   * Frontend uses this to decide which menu items / routes to show.
   */
  @Get()
  list(): Promise<FeatureFlagDto[]> {
    return this.featureFlags.listAll();
  }

  @Patch(':key')
  @RequirePermissions({ action: 'write', subject: 'FeatureFlag' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ): Promise<FeatureFlagDto> {
    return this.featureFlags.setEnabled(key, dto.enabled, {
      id: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Force a cache refresh.
   *
   * The cache has a TTL and assumes one instance (ADR-0009). When somebody
   * changes a flag directly in the database — the recovery path for a bad
   * state — this is how the running process learns about it without a
   * restart.
   */
  @Post('refresh')
  @RequirePermissions({ action: 'write', subject: 'FeatureFlag' })
  async refresh(): Promise<{ success: true; data: FeatureFlagDto[] }> {
    await this.featureFlags.forceRefresh();
    return { success: true, data: await this.featureFlags.listAll() };
  }
}
