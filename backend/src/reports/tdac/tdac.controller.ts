import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { TdacService } from './tdac.service';
import { TdacDraftService } from './tdac-draft.service';
import { TdacExportService } from './tdac-export.service';
import { CreateDraftDto, AdjustDraftDto, RejectDraftDto } from './dto/create-draft.dto';

class QueryTdacDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsOptional()
  @IsString()
  teamIds?: string;
}

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    canDispatch?: boolean;
    teamIds?: string[];
  };
}

@Controller('reports/tdac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TdacController {
  constructor(
    private readonly tdacService: TdacService,
    private readonly draftService: TdacDraftService,
    private readonly exportService: TdacExportService,
  ) {}

  // ─────────────────────────────────────────────
  // Preview / Compute endpoints
  // ─────────────────────────────────────────────

  @Get('vu-an')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async getVuAn(
    @Query() query: QueryTdacDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const teamIds = this.parseTeamIds(query.teamIds, req);
    return this.tdacService.computeTdcVuAn(new Date(query.fromDate), new Date(query.toDate), teamIds);
  }

  @Get('vu-viec')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async getVuViec(
    @Query() query: QueryTdacDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const teamIds = this.parseTeamIds(query.teamIds, req);
    return this.tdacService.computeTdcVuViec(new Date(query.fromDate), new Date(query.toDate), teamIds);
  }

  // ─────────────────────────────────────────────
  // Draft CRUD
  // ─────────────────────────────────────────────

  @Post('drafts')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async createDraft(@Body() dto: CreateDraftDto, @Req() req: AuthenticatedRequest) {
    this.validateTeamIdsAccess(dto.teamIds, req);
    return this.draftService.create(dto, req.user.id);
  }

  @Get('drafts')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async listDrafts(
    @Query('loaiBaoCao') loaiBaoCao?: string,
    @Query('status') status?: string,
  ) {
    return this.draftService.findAll({ loaiBaoCao, status });
  }

  @Get('drafts/:id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async getDraft(@Param('id') id: string) {
    return this.draftService.findOne(id);
  }

  @Patch('drafts/:id')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: AdjustDraftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.draftService.update(id, dto, req.user.id);
  }

  // ─────────────────────────────────────────────
  // Workflow transitions
  // ─────────────────────────────────────────────

  @Post('drafts/:id/submit-review')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async submitReview(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.draftService.submitReview(id, req.user.id);
  }

  @Post('drafts/:id/approve')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.draftService.approve(id, req.user.id);
  }

  @Post('drafts/:id/reject')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDraftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.draftService.reject(id, req.user.id, dto.reason);
  }

  @Post('drafts/:id/reopen')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async reopen(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.draftService.reopen(id, req.user.id);
  }

  @Post('drafts/:id/finalize')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async finalize(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.draftService.finalize(id, req.user.id);
  }

  // ─────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────

  @Get('drafts/:id/export')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async exportDraft(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const draft = await this.draftService.findOne(id);
    return this.exportService.export(draft, res);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private parseTeamIds(teamIdsRaw: string | undefined, req: AuthenticatedRequest): string[] {
    const requestedIds = teamIdsRaw
      ? teamIdsRaw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];

    this.validateTeamIdsAccess(requestedIds, req);
    return requestedIds;
  }

  private validateTeamIdsAccess(teamIds: string[], req: AuthenticatedRequest): void {
    // canDispatch = admin/dispatch officer — bypass scope check
    if (req.user?.canDispatch) return;

    const allowedTeamIds: string[] = req.user?.teamIds ?? [];
    if (allowedTeamIds.length === 0) return; // no restriction if no team scope

    const forbidden = teamIds.filter(id => !allowedTeamIds.includes(id));
    if (forbidden.length > 0) {
      throw new ForbiddenException(
        `You do not have access to team(s): ${forbidden.join(', ')}`,
      );
    }
  }
}
