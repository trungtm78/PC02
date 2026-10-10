import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AggregateService, type SummaryMode } from './aggregate.service';
import { SubmissionError } from '../submission/submission.service';
import { ReopenPeriodDto } from './dto/reopen-period.dto';

const CONFLICT_CODES = new Set(['INVALID_STATE_TRANSITION']);

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

  @Post(':periodId/finalize')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async finalize(
    @Param('periodId') periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.finalizePeriod(periodId, user.id, user.roleId),
    );
  }

  @Post(':periodId/reopen')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async reopen(
    @Param('periodId') periodId: string,
    @Body() body: ReopenPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.handleWrite(() =>
      this.aggregateService.reopenPeriod(
        periodId,
        user.id,
        user.roleId,
        body.reason,
      ),
    );
  }

  private async handleWrite<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof SubmissionError) {
        if (CONFLICT_CODES.has(err.code)) {
          throw new ConflictException({ code: err.code, message: err.message });
        }
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
  }
}
