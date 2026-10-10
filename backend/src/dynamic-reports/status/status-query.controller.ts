import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StatusQueryService } from './status-query.service';
import { ListStatusQueryDto } from './dto/list-status-query.dto';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * S19/S23 (spec §6.1 PR8) — `read:DynamicReport` only, same coarse
 * module-entry gate every other route in this module uses; the real
 * access boundary is `StatusQueryService`'s own report-scope resolution
 * (R13), never the app-wide DataScope.
 */
@Controller('bao-cao-dong/status')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class StatusQueryController {
  constructor(private readonly statusQueryService: StatusQueryService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async list(
    @Query() query: ListStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.statusQueryService.listAssignmentStatuses(
      user.id,
      user.roleId,
      {
        reportId: query.reportId,
        periodId: query.periodId,
        teamId: query.teamId,
        state: query.state,
        overdue: query.overdue,
        reopened: query.reopened,
      },
      query.page,
      query.pageSize,
    );
  }
}
