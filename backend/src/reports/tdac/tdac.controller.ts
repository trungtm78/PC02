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
import type { DataScope } from '../../auth/services/unit-scope.service';
import { chonToBaoCao, duocXemBanNhap, phamViTo } from './tdac-pham-vi';

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
  user: { id: string };
  /** Phạm vi dữ liệu do DataScopeInterceptor nạp từ CSDL (null = quản trị). */
  dataScope?: DataScope | null;
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
    const teamIds = chonToBaoCao(
      dto.teamIds ?? [],
      phamViTo(req.dataScope, 'write'),
      'write',
    );
    return this.draftService.create({ ...dto, teamIds }, req.user.id);
  }

  @Get('drafts')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async listDrafts(
    @Req() req: AuthenticatedRequest,
    @Query('loaiBaoCao') loaiBaoCao?: string,
    @Query('status') status?: string,
  ) {
    const phamVi = phamViTo(req.dataScope, 'read');
    const ds = await this.draftService.findAll({ loaiBaoCao, status });
    return ds.filter((d) => duocXemBanNhap(d, req.user.id, phamVi));
  }

  @Get('drafts/:id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async getDraft(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.layBanNhap(id, req, 'read');
  }

  @Patch('drafts/:id')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async updateDraft(
    @Param('id') id: string,
    @Body() dto: AdjustDraftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.update(id, dto, req.user.id);
  }

  // ─────────────────────────────────────────────
  // Workflow transitions
  // ─────────────────────────────────────────────

  @Post('drafts/:id/submit-review')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async submitReview(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.submitReview(id, req.user.id);
  }

  @Post('drafts/:id/approve')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.approve(id, req.user.id);
  }

  @Post('drafts/:id/reject')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDraftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.reject(id, req.user.id, dto.reason);
  }

  @Post('drafts/:id/reopen')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async reopen(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.reopen(id, req.user.id);
  }

  @Post('drafts/:id/finalize')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  async finalize(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.layBanNhap(id, req, 'write');
    return this.draftService.finalize(id, req.user.id);
  }

  // ─────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────

  @Get('drafts/:id/export')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async exportDraft(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const draft = await this.layBanNhap(id, req, 'read');
    return this.exportService.export(draft, res);
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private parseTeamIds(teamIdsRaw: string | undefined, req: AuthenticatedRequest): string[] {
    const yeuCau = teamIdsRaw
      ? teamIdsRaw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
    return chonToBaoCao(yeuCau, phamViTo(req.dataScope, 'read'));
  }

  /** Bản nháp ngoài phạm vi → 403 (đọc: tổ đọc được; ghi/chuyển trạng thái: tổ ghi được). */
  private async layBanNhap(
    id: string,
    req: AuthenticatedRequest,
    thaoTac: 'read' | 'write',
  ) {
    const draft = await this.draftService.findOne(id);
    if (!duocXemBanNhap(draft, req.user.id, phamViTo(req.dataScope, thaoTac))) {
      throw new ForbiddenException('Bạn không có quyền với bản báo cáo này');
    }
    return draft;
  }
}
