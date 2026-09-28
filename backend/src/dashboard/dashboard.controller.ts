import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // GET /api/v1/dashboard/stats
  @Get('stats')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getStats() {
    return this.dashboardService.getStats();
  }

  // GET /api/v1/dashboard/charts
  @Get('charts')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getCharts() {
    return this.dashboardService.getCharts();
  }

  // GET /api/v1/dashboard/badge-counts
  // Huy hiệu ĐẾM THEO PHẠM VI: con số trên thanh menu phải khớp số dòng người ấy mở được.
  @Get('badge-counts')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getBadgeCounts(@Req() req: ScopedRequest) {
    return this.dashboardService.getBadgeCounts(req.dataScope ?? null);
  }
}
