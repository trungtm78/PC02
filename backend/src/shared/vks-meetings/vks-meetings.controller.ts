import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { VksMeetingsService } from './vks-meetings.service';
import { UpdateVksMeetingDto } from './dto/update-vks-meeting.dto';
import { CreateVksMeetingDto } from './dto/create-vks-meeting.dto';

@Controller('cases/:caseId/vks-meetings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CaseVksMeetingsController {
  constructor(private readonly vksMeetingsService: VksMeetingsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('caseId') caseId: string, @Req() req: ScopedRequest) {
    return this.vksMeetingsService.findAllForCase(caseId, req.dataScope);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateVksMeetingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.vksMeetingsService.createForCase(
      caseId,
      dto,
      user.id,
      req.dataScope,
    );
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVksMeetingDto,
    @Req() req: ScopedRequest,
  ) {
    return this.vksMeetingsService.update(id, dto, req.dataScope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.vksMeetingsService.delete(id, req.dataScope);
  }
}

@Controller('incidents/:incidentId/vks-meetings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentVksMeetingsController {
  constructor(private readonly vksMeetingsService: VksMeetingsService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('incidentId') incidentId: string, @Req() req: ScopedRequest) {
    return this.vksMeetingsService.findAllForIncident(
      incidentId,
      req.dataScope,
    );
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateVksMeetingDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.vksMeetingsService.createForIncident(
      incidentId,
      dto,
      user.id,
      req.dataScope,
    );
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVksMeetingDto,
    @Req() req: ScopedRequest,
  ) {
    return this.vksMeetingsService.update(id, dto, req.dataScope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.vksMeetingsService.delete(id, req.dataScope);
  }
}
