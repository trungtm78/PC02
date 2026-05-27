import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationPreferencesService } from './notification-preferences.service';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  getAll(@Request() req: any) {
    return this.service.getPreferences(req.user.id as string);
  }

  @Put(':type')
  upsert(
    @Request() req: any,
    @Param('type') type: NotificationType,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.service.upsertPreference(req.user.id as string, type, dto);
  }

  @Post('reset')
  reset(@Request() req: any) {
    return this.service.resetPreferences(req.user.id as string);
  }
}
