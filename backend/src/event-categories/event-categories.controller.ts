import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { EventCategoriesService } from './event-categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

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

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 admin actions/min — anti-spam
  @RequirePermissions({ action: 'write', subject: 'Calendar' })
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'Calendar' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Calendar' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
