import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { TeamStatus } from '@prisma/client';
import type { Request } from 'express';
import { TeamsService } from './teams.service';
import { TeamLifecycleService, TEAM_ERROR } from './team-lifecycle.service';
import { SetTeamStatusDto } from './dto/set-team-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('teams')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly lifecycle: TeamLifecycleService,
  ) {}

  /** Admin list. `?status=ACTIVE|INACTIVE|ARCHIVED|ALL`; no value means active teams only. */
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Team' })
  getList(@Query('status') status?: string) {
    if (status !== undefined && status !== 'ALL' && !(Object.values(TeamStatus) as string[]).includes(status)) {
      throw new BadRequestException({ code: TEAM_ERROR.STATUS_UNKNOWN });
    }
    return this.teamsService.getList(status as TeamStatus | 'ALL' | undefined);
  }

  /** Picker list: active teams only. Declared before `:id` so the path is not read as an id. */
  @Get('options')
  @RequirePermissions({ action: 'read', subject: 'Team' })
  getOptions() {
    return this.teamsService.options();
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Team' })
  getById(@Param('id') id: string) {
    return this.teamsService.getById(id);
  }

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Team' })
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Patch(':id/status')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetTeamStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.lifecycle.setStatus(id, dto.status, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.teamsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // ── Members ────────────────────────────────────────────

  @Post(':id/members')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  addMember(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.addMember(id, userId, user.id);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.removeMember(id, userId, user.id);
  }
}
