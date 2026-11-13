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
import { TeamMergeService } from './team-merge.service';
import { MergeTeamDto } from './dto/merge-team.dto';
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
    private readonly merges: TeamMergeService,
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

  /** Recent merges, for the screen that offers Undo. Declared before `:id`. */
  @Get('merges')
  @RequirePermissions({ action: 'read', subject: 'Team' })
  listMerges() {
    return this.merges.list();
  }

  @Post('merges/:operationId/undo')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  undoMerge(
    @Param('operationId') operationId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.merges.undo(operationId, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
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

  /** What merging this team into another would do. Read-only. */
  @Post(':id/merge-preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  mergePreview(@Param('id') id: string, @Body() dto: MergeTeamDto) {
    return this.merges.preview(id, dto.targetTeamId);
  }

  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  merge(
    @Param('id') id: string,
    @Body() dto: MergeTeamDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.merges.merge(id, dto.targetTeamId, user.id, {
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
    return this.lifecycle.deleteIfEmpty(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** What still refers to the team: the delete confirmation lists it. Read-only. */
  @Get(':id/deletion-check')
  @RequirePermissions({ action: 'delete', subject: 'Team' })
  deletionCheck(@Param('id') id: string) {
    return this.lifecycle.deletionCheck(id);
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
