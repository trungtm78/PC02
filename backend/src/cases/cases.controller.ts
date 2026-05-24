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
import { CasesService } from './cases.service';
import { CasesJourneyService } from './cases-journey.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DispatchGuard } from '../auth/guards/dispatch.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { AssignCaseDto } from './dto/assign-case.dto';
import { DeleteCaseDto } from './dto/delete-case.dto'; // v0.31.0.2
import { RestoreCaseDto } from './dto/restore-case.dto'; // v0.32.0.0
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

class TdcBackfillDto {
  lyDoTamDinhChiVuAn: string;
}

@Controller('cases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly casesJourneyService: CasesJourneyService,
  ) {}

  // GET /api/v1/cases — Danh sách vụ án (paginated + filtered)
  @Get()
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getList(@Query() query: QueryCasesDto, @Req() req: ScopedRequest) {
    return this.casesService.getList(query, req.dataScope);
  }

  // GET /api/v1/cases/export/ward — Xuất vụ án theo phường/xã
  @Get('export/ward')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Case' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportWard(
    @Query() query: { unitId?: string; fromDate?: string; toDate?: string },
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.casesService.exportWardCases(query, req.dataScope, res, {
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // GET /api/v1/cases/export/other-classification — Xuất phân loại khác
  @Get('export/other-classification')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'read', subject: 'Case' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportOther(
    @Query() query: { fromDate?: string; toDate?: string; category?: string },
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.casesService.exportOtherClassification(query, req.dataScope, res);
  }

  // GET /api/v1/cases/:id/status-history — Lịch sử thay đổi trạng thái
  @Get(':id/status-history')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getStatusHistory(@Param('id') id: string) {
    return this.casesService.getStatusHistory(id);
  }

  // GET /api/v1/cases/:id/journey — Hành trình hồ sơ (multi-entity timeline)
  @Get(':id/journey')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getJourney(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.casesJourneyService.getJourney(
      id,
      user.id,
      req.dataScope,
      Number(page),
      Number(limit),
    );
  }

  // GET /api/v1/cases/:id — Chi tiết vụ án
  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getById(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.casesService.getById(id, req.dataScope);
  }

  // POST /api/v1/cases — Tạo vụ án mới
  @Post()
  @RequirePermissions({ action: 'write', subject: 'Case' })
  create(
    @Body() dto: CreateCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.casesService.create(dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope); // v0.33: pass dataScope cho ward officer auto-set assignedTeamId
  }

  // PUT /api/v1/cases/:id — Cập nhật vụ án
  @Put(':id')
  @RequirePermissions({ action: 'edit', subject: 'Case' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.casesService.update(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }, req.dataScope);
  }

  // GET /api/v1/cases/:id/delete-preflight — v0.31.0.2 kiểm tra điều kiện xóa
  @Get(':id/delete-preflight')
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  previewDelete(@Param('id') id: string, @Req() req: ScopedRequest) {
    return this.casesService.previewDelete(id, req.dataScope);
  }

  // GET /api/v1/cases/admin/deleted — v0.32.0.0 list các vụ án đã xóa mềm (ADMIN)
  @Get('admin/deleted')
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  listDeleted(@Query() query: { limit?: number; offset?: number; search?: string }) {
    return this.casesService.listDeleted({
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      search: query.search,
    });
  }

  // POST /api/v1/cases/:id/restore — v0.32.0.0 khôi phục (ADMIN via @RequirePermissions)
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  restore(
    @Param('id') id: string,
    @Body() dto: RestoreCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.casesService.restore(id, dto.reason, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  // DELETE /api/v1/cases/:id — Xóa vụ án (soft delete + reason — v0.31.0.2)
  // Mirror DELETE /incidents/:id pattern. Body bắt buộc { reason: string 10-500 chars }.
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  delete(
    @Param('id') id: string,
    @Body() dto: DeleteCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.casesService.delete(
      id,
      dto.reason,
      user.id,
      user.role,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      req.dataScope,
    );
  }

  // PATCH /api/v1/cases/:id/tdc-backfill — Backfill TĐC lý do tạm đình chỉ
  @Patch(':id/tdc-backfill')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'write', subject: 'Case' })
  async tdcBackfill(
    @Param('id') id: string,
    @Body() dto: TdcBackfillDto,
    @Req() req: any,
  ) {
    return this.casesService.tdcBackfill(id, dto.lyDoTamDinhChiVuAn, req.user.userId);
  }

  // PATCH /api/v1/cases/:id/assign — Phân công / tái phân công vụ án (dispatcher only)
  @Patch(':id/assign')
  @UseGuards(DispatchGuard)
  assignCase(
    @Param('id') id: string,
    @Body() dto: AssignCaseDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.casesService.assignCase(id, dto, user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
