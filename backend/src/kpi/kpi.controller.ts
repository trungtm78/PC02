import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { KpiService } from './kpi.service';
import { QueryKpiDto } from './dto/query-kpi.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { DataScope } from '../auth/services/unit-scope.service';

@Controller('kpi')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  // GET /api/v1/kpi/summary — 4 KPI tổng hợp theo kỳ
  @Get('summary')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getSummary(@Query() query: QueryKpiDto) {
    return this.kpiService.getKpiSummary(query);
  }

  // GET /api/v1/kpi/trend — xu hướng 12 tháng
  @Get('trend')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getTrend(@Query() query: QueryKpiDto) {
    return this.kpiService.getKpiTrend(query.year);
  }

  // GET /api/v1/kpi/by-team — KPI từng Tổ (level 1)
  // Admin/lãnh đạo xem tất cả; cán bộ thường chỉ xem tổ trong phạm vi dataScope
  @Get('by-team')
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  getByTeam(@Query() query: QueryKpiDto, @Req() req: Request) {
    const dataScope: DataScope | null = (req as any).dataScope ?? null;
    const allowedTeamIds = dataScope ? dataScope.teamIds : null;
    return this.kpiService.getKpiByTeam(query, allowedTeamIds);
  }
}
