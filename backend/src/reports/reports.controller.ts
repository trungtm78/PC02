import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { IsOptional, IsInt, IsString, IsDateString, IsIn, Min, Max } from 'class-validator';
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

class Stat48QueryDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsIn(['json', 'excel'])
  format?: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsExportService: ReportsExportService,
  ) {}

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

  // GET /api/v1/reports/monthly/export
  @Get('monthly/export')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportMonthly(@Query() query: QueryMonthlyDto, @Res() res: Response) {
    const year = query.year ?? new Date().getFullYear();
    const data = await this.reportsService.getMonthly(year, query.month);
    await this.reportsExportService.exportMonthly(data as any, res);
  }

  // GET /api/v1/reports/quarterly/export
  @Get('quarterly/export')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async exportQuarterly(@Query() query: QueryQuarterlyDto, @Res() res: Response) {
    const year = query.year ?? new Date().getFullYear();
    const data = await this.reportsService.getQuarterly(year, query.quarter);
    await this.reportsExportService.exportQuarterly(data as any, res);
  }

  // GET /api/v1/reports/stat48?fromDate=&toDate=&unit=&format=
  @Get('stat48')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async getStat48(@Query() query: Stat48QueryDto, @Res() res: Response) {
    const data = await this.reportsService.getStat48(
      query.fromDate,
      query.toDate,
      query.unit,
    );
    if (query.format === 'excel') {
      await this.reportsExportService.exportStat48(data as any, res);
    } else {
      res.json(data);
    }
  }
}
