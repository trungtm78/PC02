import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { EventCategoriesService } from './event-categories.service';

@Controller('event-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@FeatureFlag('event_categories_v2')
export class EventCategoriesController {
  constructor(private readonly service: EventCategoriesService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // POST/PATCH/DELETE deferred to PR 2 (admin CRUD).
}
