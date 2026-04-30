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
import { ActionPlansService } from './action-plans.service';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';

@Controller('cases/:caseId/action-plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CaseActionPlansController {
  constructor(private readonly actionPlansService: ActionPlansService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('caseId') caseId: string) {
    return this.actionPlansService.findAllForCase(caseId);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateActionPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.actionPlansService.createForCase(caseId, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string) {
    return this.actionPlansService.delete(id);
  }
}

@Controller('incidents/:incidentId/action-plans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentActionPlansController {
  constructor(private readonly actionPlansService: ActionPlansService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  findAll(@Param('incidentId') incidentId: string) {
    return this.actionPlansService.findAllForIncident(incidentId);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateActionPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.actionPlansService.createForIncident(incidentId, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  delete(@Param('id') id: string) {
    return this.actionPlansService.delete(id);
  }
}
