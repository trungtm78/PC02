import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

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
  @Get('badge-counts')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getBadgeCounts() {
    return this.dashboardService.getBadgeCounts();
  }
}
