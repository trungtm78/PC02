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
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeamStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { TeamsService } from './teams.service';
import { TeamLifecycleService, TEAM_ERROR } from './team-lifecycle.service';
import { TeamMergeService } from './team-merge.service';
import { TeamWardChargesService } from './team-ward-charges.service';
import { TeamWardChargesImportService } from './team-ward-charges.import';
import { WARD_CHARGE_ERROR, WARD_CHARGE_IMPORT_MAX_BYTES } from './team-ward-charges.codes';
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
    private readonly wardCharges: TeamWardChargesService,
    private readonly wardChargeImport: TeamWardChargesImportService,
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

  // ── Wards in charge ("Phường/xã phụ trách") ─────────────────────────────────────────────────────────────────
  // Every route takes the permission of `PUT /teams/:id` (editing a team). Declared before `:id`.

  /** The ward teams a PC02 team can be put in charge of, each with the team now in charge of its ward. */
  @Get('ward-charge-choices')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  wardChargeChoices() {
    return this.wardCharges.choices();
  }

  @Post('ward-charges/import/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: WARD_CHARGE_IMPORT_MAX_BYTES * 2, files: 1 } }))
  wardChargeImportPreview(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException({ code: WARD_CHARGE_ERROR.IMPORT_FILE_INVALID, details: [{ reason: 'EMPTY' }] });
    return this.wardChargeImport.preview(file.buffer, user.id);
  }

  @Post('ward-charges/import/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  wardChargeImportConfirm(
    @Body() body: { previewToken?: unknown; replaceTeamsInFile?: unknown },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.wardChargeImport.confirm(body?.previewToken, body?.replaceTeamsInFile, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('ward-charges/import/template.xlsx')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  async wardChargeImportTemplate(@Res() res: Response) {
    const buffer = await this.wardChargeImport.template();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="phuong-xa-phu-trach.xlsx"`);
    res.send(buffer);
  }

  @Get(':id/ward-charges')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  listWardCharges(@Param('id') id: string) {
    return this.wardCharges.listFor(id);
  }

  @Put(':id/ward-charges')
  @RequirePermissions({ action: 'edit', subject: 'Team' })
  replaceWardCharges(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.wardCharges.replace(id, body, user.id, {
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
