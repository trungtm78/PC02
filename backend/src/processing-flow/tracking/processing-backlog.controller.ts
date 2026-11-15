import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { BacklogQueryDto, OnTimeQueryDto, UnappliedQueryDto } from './dto/tracking.dto';
import { ProcessingBacklogService } from './processing-backlog.service';

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
 * The backlog by unit ("Tồn đọng theo đơn vị"), its export, and the on-time report. Behind the
 * `processing_flow_records` switch (404 while it is off) and the permission `read:ProcessingStep`.
 *
 * As on the tracking screen, the permission opens the routes only: a unit appears with the work of the records the
 * person may read (`ProcessingTrackingService.reach`), and with nothing else.
 */
@Controller('processing/backlog')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow_records')
export class ProcessingBacklogController {
  constructor(private readonly backlog: ProcessingBacklogService) {}

  @Get('units')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  units(@Query() query: BacklogQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.backlog.units(gatewayUser(user), query);
  }

  @Get('units/export')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  async exportUnits(@Query() query: BacklogQueryDto, @CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const { buffer, asOf } = await this.backlog.unitsWorkbook(gatewayUser(user), query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ton-dong-theo-don-vi-${asOf.slice(0, 10)}.xlsx"`);
    res.send(buffer);
  }

  /** The records one number of the column "Chưa áp quy trình" counts: the same condition, for one unit and one kind. */
  @Get('unapplied')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  unapplied(@Query() query: UnappliedQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.backlog.unapplied(gatewayUser(user), query);
  }

  /**
   * The units the filter of the screen offers: every unit a row of the table may be about (it works a step the person
   * may see, in any role, or holds a record with no flow in the person's scope). Needs neither `read:Team` nor `read:User`.
   */
  @Get('teams')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  teams(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    if (Object.keys(query).length > 0) throw new BadRequestException();
    return this.backlog.teams(gatewayUser(user));
  }

  @Get('on-time')
  @RequirePermissions({ action: 'read', subject: 'ProcessingStep' })
  onTime(@Query() query: OnTimeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.backlog.onTime(gatewayUser(user), query);
  }
}
