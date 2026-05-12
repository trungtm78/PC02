import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { EventRemindersService } from './event-reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Controller('events/:eventId/reminders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@FeatureFlag('event_reminders_v2')
export class EventRemindersController {
  constructor(private readonly service: EventRemindersService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  list(@Param('eventId') eventId: string, @Request() req: any) {
    return this.service.listForEvent(eventId, req.user.id);
  }

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 20 reminders/min per user
  @RequirePermissions({ action: 'write', subject: 'Calendar' })
  create(@Param('eventId') eventId: string, @Body() dto: CreateReminderDto, @Request() req: any) {
    return this.service.create(eventId, dto, req.user.id);
  }

  @Delete(':reminderId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Calendar' })
  remove(
    @Param('eventId') eventId: string,
    @Param('reminderId') reminderId: string,
    @Request() req: any,
  ) {
    return this.service.remove(eventId, reminderId, req.user.id);
  }
}
