import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { CalendarEventsService } from './calendar-events.service';

@Controller('calendar-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@FeatureFlag('calendar_events_v2')
export class CalendarEventsController {
  constructor(private readonly service: CalendarEventsService) {}

  /**
   * PR 1: minimal read endpoint behind feature flag.
   * Query: ?year=2026[&month=8]
   * PR 2 adds scope/category filters, RRULE expansion, POST/PATCH/DELETE.
   */
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  list(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : undefined;
    const from = m !== undefined ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
    const to = m !== undefined ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999);
    return this.service.findInRange(from, to);
  }
}
