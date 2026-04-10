import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class QueryMonthlyDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;
}

class QueryQuarterlyDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  @Type(() => Number)
  quarter?: number;
}

class QueryDistrictStatsDto {
  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  district?: string;
}

class QueryOverdueDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  recordType?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minDaysOverdue?: number;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // GET /api/v1/reports/monthly?year=&month=
  @Get('monthly')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getMonthly(@Query() query: QueryMonthlyDto) {
    const year = query.year ?? new Date().getFullYear();
    return this.reportsService.getMonthly(year, query.month);
  }

  // GET /api/v1/reports/quarterly?year=&quarter=
  @Get('quarterly')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getQuarterly(@Query() query: QueryQuarterlyDto) {
    const year = query.year ?? new Date().getFullYear();
    return this.reportsService.getQuarterly(year, query.quarter);
  }

  // GET /api/v1/reports/district-stats?fromDate=&toDate=&district=
  @Get('district-stats')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getDistrictStats(@Query() query: QueryDistrictStatsDto) {
    return this.reportsService.getDistrictStats(query.fromDate, query.toDate, query.district);
  }

  // GET /api/v1/reports/overdue
  @Get('overdue')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getOverdue(@Query() query: QueryOverdueDto) {
    return this.reportsService.getOverdue(
      query.search,
      query.recordType,
      query.priority,
      query.minDaysOverdue,
    );
  }
}
