import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { EventRemindersService } from './event-reminders.service';

@Controller('events/:eventId/reminders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@FeatureFlag('event_reminders_v2')
export class EventRemindersController {
  constructor(private readonly service: EventRemindersService) {}

  /**
   * PR 1: read-only — list current user's reminders for an event.
   * PR 2 adds POST/DELETE + cron dispatcher service.
   */
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  list(@Param('eventId') eventId: string, @Request() req: any) {
    return this.service.listForEvent(eventId, req.user.id);
  }
}
