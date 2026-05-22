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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import { PetitionsService } from './petitions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { UpdatePetitionDto } from './dto/update-petition.dto';
import { QueryPetitionsDto } from './dto/query-petitions.dto';
import { ExportPetitionsQueryDto } from './dto/export-petitions-query.dto';
import { ConvertToIncidentDto } from './dto/convert-incident.dto';
import { ConvertToCaseDto } from './dto/convert-case.dto';
import { AssignPetitionDto } from './dto/assign-petition.dto';
import { RestorePetitionDto } from './dto/restore-petition.dto'; // v0.32.0.0
import { ListLinkableDto } from './dto/list-linkable.dto'; // v0.37.1
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
@Controller('petitions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PetitionsController {
  constructor(private readonly petitionsService: PetitionsService) {}

  // GET /api/v1/petitions — Danh sách đơn thư
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getList(@Query() query: QueryPetitionsDto, @Req() req: ScopedRequest) {
    return this.petitionsService.getList(query, req.dataScope);
  }

  // v0.37.1 PR-PICK — GET /api/v1/petitions/linkable
  // Returns unlinked Petitions in user's scope for Case form Petition picker.
  // Used by CaseFormPage CaseProvenancePicker when caseProvenance=FROM_PETITION.
  @Get('linkable')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  listLinkable(@Query() query: ListLinkableDto, @Req() req: ScopedRequest) {
    return this.petitionsService.listLinkable(query, req.dataScope);
  }

  // GET /api/v1/petitions/export — Xuất danh sách đơn thư ra Excel
  @Get('export')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportExcel(
    @Query() query: ExportPetitionsQueryDto,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const user = (req as any).user as AuthUser | undefined;
    await this.petitionsService.exportToExcel(query, req.dataScope, res, user?.id);
  }

  // GET /api/v1/petitions/export/duplicates — Xuất danh sách đơn trùng lặp ra Excel
  @Get('export/duplicates')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportDuplicates(
    @Query() query: { status?: string; criteria?: string; fromDate?: string; toDate?: string },
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.exportDuplicates(query, req.dataScope, res);
  }

  // GET /api/v1/petitions/:id — Chi tiết đơn thư
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.petitionsService.getById(id, req.dataScope);
  }

  // GET /api/v1/petitions/:id/export-word — Xuất đơn thư ra Word
  @Get(':id/export-word')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequirePermissions({ action: 'read', subject: 'Petition' })
  async exportWord(
    @Param('id') id: string,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.petitionsService.exportToWord(id, req.dataScope, res);
  }

  // POST /api/v1/petitions — Tạo đơn thư mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Petition' })
  create(
    @Body() dto: CreatePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope); // v0.33: ward officer auto-set
  }

  // PUT /api/v1/petitions/:id — Cập nhật đơn thư
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // DELETE /api/v1/petitions/:id — Xóa đơn thư (soft delete)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Petition' })
  delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.delete(id, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // GET /api/v1/petitions/admin/deleted — v0.32.0.0 list đơn thư đã xóa mềm (ADMIN)
  @Get('admin/deleted')
  @RequirePermissions({ action: 'restore', subject: 'Petition' })
  listDeleted(@Query() query: { limit?: number; offset?: number; search?: string }) {
    return this.petitionsService.listDeleted({
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      search: query.search,
    });
  }

  // POST /api/v1/petitions/:id/restore — v0.32.0.0 khôi phục (ADMIN)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Petition' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestorePetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.restore(id, dto.reason, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // POST /api/v1/petitions/:id/convert-incident — Chuyển thành Vụ việc
  @Post(':id/convert-incident')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  convertToIncident(
    @Param('id') id: string,
    @Body() dto: ConvertToIncidentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.convertToIncident(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // POST /api/v1/petitions/:id/convert-case — Chuyển thành Vụ án
  @Post(':id/convert-case')
  @RequirePermissions({ action: 'edit', subject: 'Petition' })
  convertToCase(
    @Param('id') id: string,
    @Body() dto: ConvertToCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.convertToCase(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // PATCH /api/v1/petitions/:id/assign — Phân công / tái phân công đơn thư (dispatcher only)
  @Patch(':id/assign')
  @UseGuards(DispatchGuard)
  assignPetition(
    @Param('id') id: string,
    @Body() dto: AssignPetitionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.petitionsService.assignPetition(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
