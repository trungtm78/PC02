import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AggregateService, type SummaryMode } from './aggregate.service';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

const VALID_MODES: readonly SummaryMode[] = [
  'SUBMITTED',
  'APPROVED',
  'ALL_SAVED',
];

/**
 * S15 thu nhỏ (spec §6.1 PR7 slice 2). `read:DynamicReport` only — the
 * same coarse module-entry gate every dynamic-reports route uses; the
 * real access boundary is `AggregateService`'s own `DynReportRole`/
 * `admin:DynamicReport` check (R13), which 404s a period the caller
 * doesn't manage instead of 403ing it (AC-012/AC-035 anti-probe
 * convention already used by every other route in this module).
 */
@Controller('bao-cao-dong/periods')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class AggregateController {
  constructor(private readonly aggregateService: AggregateService) {}

  @Get(':periodId/summary')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async getSummary(
    @Param('periodId') periodId: string,
    @Query('mode') mode: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const resolvedMode: SummaryMode = VALID_MODES.includes(mode as SummaryMode)
      ? (mode as SummaryMode)
      : 'SUBMITTED';
    return this.aggregateService.getPeriodSummary(
      periodId,
      user.id,
      user.roleId,
      resolvedMode,
    );
  }
}
