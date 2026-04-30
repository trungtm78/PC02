import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { VksMeetingsService } from './vks-meetings.service';
import { CreateVksMeetingDto } from './dto/create-vks-meeting.dto';

@Controller('cases/:caseId/vks-meetings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CaseVksMeetingsController {
  constructor(private readonly vksMeetingsService: VksMeetingsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('caseId') caseId: string) {
    return this.vksMeetingsService.findAllForCase(caseId);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateVksMeetingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vksMeetingsService.createForCase(caseId, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string) {
    return this.vksMeetingsService.delete(id);
  }
}

@Controller('incidents/:incidentId/vks-meetings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentVksMeetingsController {
  constructor(private readonly vksMeetingsService: VksMeetingsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('incidentId') incidentId: string) {
    return this.vksMeetingsService.findAllForIncident(incidentId);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateVksMeetingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vksMeetingsService.createForIncident(incidentId, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string) {
    return this.vksMeetingsService.delete(id);
  }
}
