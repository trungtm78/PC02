import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DynamicReportsRegistryService } from './reports.service';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

@Controller('bao-cao-dong/reports')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class ReportsController {
  constructor(private readonly service: DynamicReportsRegistryService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  list(
    @Query() query: ListReportsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listReports(user, query.mode);
  }
}
