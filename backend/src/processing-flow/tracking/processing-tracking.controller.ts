import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { TrackingItemsQueryDto, TrackingQueryDto } from './dto/tracking.dto';
import { ProcessingTrackingService } from './processing-tracking.service';

interface AuthenticatedUser {
  id: string;
  role?: string | { name?: string };
  canDispatch?: boolean;
}

const gatewayUser = (user: AuthenticatedUser) => ({
  id: user.id,
  role: typeof user.role === 'string' ? user.role : (user.role?.name ?? ''),
  canDispatch: user.canDispatch ?? false,
});

/**
 * The tracking screen ("Theo dõi xử lý"): the four cards and the list behind each. Behind the
 * `processing_flow_records` switch (404 while it is off) and the permission `read:ProcessingStep`.
 *
 * The permission opens the routes only. WHICH work a person sees is decided by the read policy of each record
 * (`ProcessingTrackingService.reach`): nothing of a record the person could not open is counted or listed.
 */
@Controller('processing/tracking')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow_records')
export class ProcessingTrackingController {
  constructor(private readonly tracking: ProcessingTrackingService) {}

  @Get('summary')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  summary(@Query() query: TrackingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tracking.summary(gatewayUser(user), query);
  }

  @Get('items')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  items(@Query() query: TrackingItemsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tracking.items(gatewayUser(user), query);
  }
}
