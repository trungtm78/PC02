import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Post,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /api/v1/settings — all settings
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  getAll() {
    return this.settingsService.getAll();
  }

  // GET /api/v1/settings/deadlines — deadline settings for frontend
  @Get('deadlines')
  @RequirePermissions({ action: 'read', subject: 'Setting' })
  getDeadlines() {
    return this.settingsService.getDeadlines();
  }

  // PUT /api/v1/settings/:key — update setting value (admin only)
  @Put(':key')
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  updateValue(@Param('key') key: string, @Body('value') value: string) {
    return this.settingsService.updateValue(key, value);
  }

  // POST /api/v1/settings/seed — seed defaults (admin only)
  @Post('seed')
  @RequirePermissions({ action: 'write', subject: 'Setting' })
  seed() {
    return this.settingsService.seed();
  }
}
