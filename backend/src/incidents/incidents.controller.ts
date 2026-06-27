import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { IncidentsService } from './incidents.service';
import { DynamicExportService } from '../document-templates/dynamic-export.service';
import { ExportEntityDocumentsDto } from '../document-templates/dto/export-entity-documents.dto';
import { IncidentsJourneyService } from './incidents-journey.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';
import { QueryIncidentsStatsDto } from './dto/query-incidents-stats.dto';
import { AssignInvestigatorDto } from './dto/assign-investigator.dto';
import { ProsecuteIncidentDto } from './dto/prosecute-incident.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MergeIncidentDto } from './dto/merge-incident.dto';
import { TransferIncidentDto } from './dto/transfer-incident.dto';
import { DeleteIncidentDto } from './dto/delete-incident.dto';
import { RestoreIncidentDto } from './dto/restore-incident.dto'; // v0.32.0.0
import { ListLinkableIncidentDto } from './dto/list-linkable.dto'; // v0.37.1.1 PROV-004
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

@Controller('incidents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly incidentsJourneyService: IncidentsJourneyService,
    private readonly dynamicExport: DynamicExportService,
  ) {}

  // POST /api/v1/incidents/:id/export-documents — xuất chứng từ động (gộp/zip) cho vụ việc
  @Post(':id/export-documents')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  async exportDocuments(
    @Param('id') id: string,
    @Body() dto: ExportEntityDocumentsDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    const record = await this.incidentsService.getById(id, req.dataScope); // RBAC scope-checked
    await this.dynamicExport.exportEntityDocuments(
      'VU_VIEC',
      id,
      record,
      dto.templateIds,
      dto.mode ?? 'merged',
      user.id,
      dto.manualValues ?? {},
      res,
    );
  }

  // GET /api/v1/incidents — Danh sách vụ việc
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getList(@Query() query: QueryIncidentsDto, @Req() req: ScopedRequest) {
    return this.incidentsService.getList(query, req.dataScope);
  }

  // v0.37.1.1 PROV-004 — GET /api/v1/incidents/linkable
  // Returns unlinked Incidents in user's scope for Case form Incident picker.
  // Used by CaseFormPage CaseProvenancePicker when caseProvenance=FROM_INCIDENT.
  // Mirror of /petitions/linkable (PR-PICK).
  @Get('linkable')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  listLinkable(@Query() query: ListLinkableIncidentDto, @Req() req: ScopedRequest) {
    return this.incidentsService.listLinkable(query, req.dataScope);
  }

  // GET /api/v1/incidents/stats — Counts by IncidentStatus, scoped to active non-status filters.
  // PR2/T1: refactored to PR1 Cases stats pattern (exhaustive byStatus + dedicated DTO).
  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getStats(@Query() query: QueryIncidentsStatsDto, @Req() req: ScopedRequest) {
    return this.incidentsService.getStats(query, req.dataScope);
  }

  // GET /api/v1/incidents/investigators — Danh sách điều tra viên
  @Get('investigators')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getInvestigators(@Query('search') search?: string) {
    return this.incidentsService.getInvestigators(search);
  }

  // GET /api/v1/incidents/export/ward — Xuất vụ việc theo phường/xã ra Excel
  @Get('export/ward')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportWard(
    @Query() query: { unitId?: string; fromDate?: string; toDate?: string },
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.incidentsService.exportWardIncidents(query, req.dataScope, res, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // GET /api/v1/incidents/:id/journey — Hành trình vụ án
  @Get(':id/journey')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getJourney(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    return this.incidentsJourneyService.getJourney(id, req.dataScope ?? null, safePage, safeLimit);
  }

  // GET /api/v1/incidents/:id/delete-preflight — v0.43 kiểm tra trước khi xóa
  @Get(':id/delete-preflight')
  @RequirePermissions({ action: 'delete', subject: 'Incident' })
  deletePreflight(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.incidentsService.previewDelete(id, req.dataScope);
  }

  // GET /api/v1/incidents/:id — Chi tiết vụ việc
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.incidentsService.getById(id, req.dataScope);
  }

  // POST /api/v1/incidents — Tạo vụ việc mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Incident' })
  create(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope); // v0.33
  }

  // PUT /api/v1/incidents/:id — Cập nhật vụ việc
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // DELETE /api/v1/incidents/:id — Xóa vụ việc (soft delete, 6 business rules)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Incident' })
  delete(
    @Param('id') id: string,
    @Body() dto: DeleteIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const dataScope = req.dataScope ?? null;
    return this.incidentsService.delete(
      id,
      dto.reason,
      user.id,
      user.role,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      dataScope,
    );
  }

  // GET /api/v1/incidents/admin/deleted — v0.32.0.0 list vụ việc đã xóa mềm (ADMIN)
  @Get('admin/deleted')
  @RequirePermissions({ action: 'restore', subject: 'Incident' })
  listDeleted(@Query() query: { limit?: number; offset?: number; search?: string }) {
    return this.incidentsService.listDeleted({
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      search: query.search,
    });
  }

  // POST /api/v1/incidents/:id/restore — v0.32.0.0 khôi phục (ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Incident' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestoreIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.restore(id, dto.reason, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // PATCH /api/v1/incidents/:id/status — Đổi trạng thái
  @Patch(':id/status')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.updateStatus(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // PATCH /api/v1/incidents/:id/merge — Nhập vào vụ khác
  @Patch(':id/merge')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  mergeInto(
    @Param('id') id: string,
    @Body() dto: MergeIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.mergeInto(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // PATCH /api/v1/incidents/:id/transfer — Chuyển đơn vị
  @Patch(':id/transfer')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  transferUnit(
    @Param('id') id: string,
    @Body() dto: TransferIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.transferUnit(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // PATCH /api/v1/incidents/:id/assign — Phân công điều tra viên (dispatcher only)
  @Patch(':id/assign')
  @UseGuards(DispatchGuard)
  assignInvestigator(
    @Param('id') id: string,
    @Body() dto: AssignInvestigatorDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.assignInvestigator(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // POST /api/v1/incidents/:id/extend — Gia hạn thời hạn (Điều 147 khoản 2-3 BLTTHS)
  @Post(':id/extend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  extendDeadline(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.extendDeadline(
      id,
      user.id,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.dataScope,
    );
  }

  // POST /api/v1/incidents/:id/prosecute — Khởi tố vụ việc → Vụ án
  @Post(':id/prosecute')
  @RequirePermissions({ action: 'edit', subject: 'Incident' })
  prosecute(
    @Param('id') id: string,
    @Body() dto: ProsecuteIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.incidentsService.prosecute(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }
}
