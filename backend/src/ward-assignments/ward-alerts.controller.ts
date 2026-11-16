import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { DataScope } from '../auth/services/unit-scope.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../feature-flags/guards/feature-flag.guard';
import { WardMatchConclusionDto, WardStatsQueryDto } from './dto/ward-alerts.dto';
import { WARD_ERROR } from './ward-assignment.codes';
import { wardBody } from './ward-errors';
import { WardMatchingService } from './ward-matching.service';
import { WardStatsService } from './ward-stats.service';

/** The scope the request interceptor resolved; none at all is refused (see `ward-assignments.controller.ts`). */
function scopeOf(req: ScopedRequest): DataScope | null {
  if (req.dataScope === undefined) throw new ForbiddenException(wardBody(WARD_ERROR.FORBIDDEN));
  return req.dataScope;
}

/**
 * Subject matching and statistics of ward assignment requests. Registered BEFORE `WardAssignmentsController` in the
 * module, so that `GET /ward-assignments/stats` is this route and not `GET /ward-assignments/:id`.
 */
@Controller('ward-assignments')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('ward-assignments')
export class WardAlertsController {
  constructor(
    private readonly matching: WardMatchingService,
    private readonly statistics: WardStatsService,
  ) {}

  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  stats(@Query() query: WardStatsQueryDto, @Req() req: ScopedRequest) {
    return this.statistics.stats(scopeOf(req), query);
  }

  @Get(':id/subject-matches')
  @RequirePermissions({ action: 'read', subject: 'WardAssignment' })
  matches(@Param('id') id: string, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.matching.matches(scopeOf(req), user.id, id);
  }

  @Post(':id/subject-matches/conclusions')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'review', subject: 'WardAssignment' })
  conclude(@Param('id') id: string, @Body() body: WardMatchConclusionDto, @CurrentUser() user: { id: string }, @Req() req: ScopedRequest) {
    return this.matching.conclude(scopeOf(req), user.id, id, {
      subjectPosition: body.subjectPosition,
      otherSource: body.otherSource,
      otherRecordId: body.otherRecordId,
      samePerson: (body.samePerson ?? body.sameperson) as boolean,
    });
  }
}
