import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagsService, FeatureFlagDto } from './feature-flags.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard)
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
}
