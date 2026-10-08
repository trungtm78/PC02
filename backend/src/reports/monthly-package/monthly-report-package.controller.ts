import { UseInterceptors } from '@nestjs/common';
import { CaseGraphAccessInterceptor } from '../graph-access/case-graph-access.interceptor';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { Request, Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';
import { chonToBaoCao, duocXemBanNhap, phamViTo } from '../tdac/tdac-pham-vi';
import { MonthlyReportPackageService } from './monthly-report-package.service';
import type { MonthlyReportStatus } from './monthly-report.rules';

class CreateMonthlyReportDto {
  @IsNgayThat() periodStart: string;
  @IsNgayThat() periodEnd: string;
  @IsOptional() @IsString() unitCode?: string;
  @IsString() @MinLength(1) unitName: string;
  @IsArray() @IsString({ each: true }) teamIds: string[] = [];
  @IsOptional() @IsString() templateVersion?: string;
}

class TransitionDto {
  @IsOptional() @IsString() reason?: string;
}
class AdjustmentDto {
  @IsString() appendix: string;
  @IsString() targetKey: string;
  @IsOptional() @IsString() entityId?: string;
  @IsIn(['ADD', 'REMOVE', 'REPLACE', 'CONFIRM']) operation: string;
  @IsOptional() previousValue?: unknown;
  @IsDefined() newValue: unknown;
  @IsString() @MinLength(3) reason: string;
  @IsDefined() evidence: unknown;
  @IsOptional() @IsString() issueCode?: string;
}

interface AuthenticatedRequest extends Request {
  user: { id: string };
  dataScope?: DataScope | null;
}

@UseInterceptors(CaseGraphAccessInterceptor)
@Controller('reports/monthly-packages')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MonthlyReportPackageController {
  constructor(
    private readonly service: MonthlyReportPackageService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async create(
    @Body() dto: CreateMonthlyReportDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const teamIds = chonToBaoCao(
      dto.teamIds,
      phamViTo(req.dataScope, 'write'),
      'write',
    );
    const report = await this.service.create({ ...dto, teamIds }, req.user.id);
    await this.log(req, 'MONTHLY_REPORT_CREATED', report.id, {
      version: report.version,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
    });
    return report;
  }

  @Get()
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  async list(@Req() req: AuthenticatedRequest) {
    const reports = await this.service.list();
    const scope = phamViTo(req.dataScope, 'read');
    return reports
      .filter((report) => duocXemBanNhap(report, req.user.id, scope))
      .slice(0, 100);
  }

  @Get(':id')
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  async get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.authorized(id, req, 'read');
    return this.service.get(id);
  }

  @Get(':id/appendices/:code')
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  async appendix(
    @Param('id') id: string,
    @Param('code') code: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authorized(id, req, 'read');
    return this.service.appendix(id, code);
  }

  @Get(':id/drilldown')
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  async drilldown(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('appendix') appendix: string,
    @Query('metricKey') metricKey: string,
    @Query('cellKey') cellKey?: string,
    @Query('entityId') entityId?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.authorized(id, req, 'read');
    return this.service.drilldown(id, {
      appendix,
      metricKey,
      cellKey,
      entityId,
      q,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Post(':id/submit')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  transitionSubmit(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.doTransition(id, 'REVIEWING', req);
  }
  @Post(':id/approve')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  transitionApprove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.doTransition(id, 'APPROVED', req);
  }
  @Post(':id/finalize')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  transitionFinalize(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.doTransition(id, 'FINALIZED', req);
  }
  @Post(':id/reject')
  @RequirePermissions({ action: 'approve', subject: 'Report' })
  transitionReject(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: TransitionDto,
  ) {
    return this.doTransition(id, 'REJECTED', req, dto.reason);
  }
  @Post(':id/reopen')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  transitionReopen(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.doTransition(id, 'DRAFT', req);
  }

  @Post(':id/adjustments')
  @RequirePermissions({ action: 'write', subject: 'Report' })
  async adjustment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdjustmentDto,
  ) {
    await this.authorized(id, req, 'write');
    const result = await this.service.addAdjustment(id, dto, req.user.id);
    await this.log(req, 'MONTHLY_REPORT_ADJUSTED', id, {
      appendix: dto.appendix,
      targetKey: dto.targetKey,
      operation: dto.operation,
      issueCode: dto.issueCode,
    });
    return result;
  }

  @Get(':id/export/:kind')
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async export(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.authorized(id, req, 'read');
    if (!['detail', 'summary'].includes(kind))
      throw new ForbiddenException('Loại tệp không hợp lệ');
    const buffer = await this.service.workbook(
      id,
      kind === 'detail' ? 'DETAIL' : 'SUMMARY',
    );
    await this.log(req, 'MONTHLY_REPORT_EXPORTED', id, { kind });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bao-cao-thang-${kind}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get(':id/verification')
  @RequirePermissions(
    { action: 'read', subject: 'Case' },
    { action: 'read', subject: 'Incident' },
  )
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async verification(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.authorized(id, req, 'read');
    const data = await this.service.verification(id);
    await this.log(req, 'MONTHLY_REPORT_VERIFICATION_EXPORTED', id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="goi-kiem-chung-bao-cao.json"',
    );
    res.send(JSON.stringify(data, null, 2));
  }

  private async doTransition(
    id: string,
    next: MonthlyReportStatus,
    req: AuthenticatedRequest,
    reason?: string,
  ) {
    await this.authorized(
      id,
      req,
      next === 'APPROVED' || next === 'FINALIZED' || next === 'REJECTED'
        ? 'read'
        : 'write',
    );
    const report = await this.service.transition(id, next, req.user.id, reason);
    await this.log(req, 'MONTHLY_REPORT_STATUS_CHANGED', id, { next, reason });
    return report;
  }
  private async authorized(
    id: string,
    req: AuthenticatedRequest,
    mode: 'read' | 'write',
  ) {
    const report = await this.service.getAccess(id);
    if (!duocXemBanNhap(report, req.user.id, phamViTo(req.dataScope, mode)))
      throw new ForbiddenException('Bạn không có quyền với gói báo cáo này');
    return report;
  }
  private log(
    req: AuthenticatedRequest,
    action: string,
    subjectId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.log({
      userId: req.user.id,
      action,
      subject: 'MonthlyReportPackage',
      subjectId,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
}
