import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { KieuSoSanh } from './so-sanh-ky';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { IsOptional, IsInt, IsString, IsDateString, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EXPORT_FORMAT } from '../common/constants/export-format.constants';

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

  /**
   * Nền để so sánh. Mặc định `CUNG_KY_NAM_TRUOC` theo quy ước báo cáo ngành — báo cáo Công an
   * luôn viết "so với cùng kỳ năm trước", không phải "so với tháng trước".
   */
  @IsOptional()
  @IsIn(['CUNG_KY_NAM_TRUOC', 'KY_LIEN_TRUOC', 'TUY_CHON', 'KHONG'])
  soSanh?: KieuSoSanh;

  /** Lũy kế từ đầu năm tới hết tháng này. Loại trừ với cặp `tu`/`den`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  luyKeDenThang?: number;

  /** Khoảng tự chọn cho KỲ ĐANG XEM — phải đủ cả hai đầu. */
  @IsOptional()
  @IsDateString()
  tu?: string;

  @IsOptional()
  @IsDateString()
  den?: string;

  /** Khoảng tự chọn cho KỲ NỀN, dùng với `soSanh=TUY_CHON`. */
  @IsOptional()
  @IsDateString()
  nenTu?: string;

  @IsOptional()
  @IsDateString()
  nenDen?: string;
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

  /**
   * Nền để so sánh. Mặc định `CUNG_KY_NAM_TRUOC` theo quy ước báo cáo ngành — báo cáo Công an
   * luôn viết "so với cùng kỳ năm trước", không phải "so với tháng trước".
   */
  @IsOptional()
  @IsIn(['CUNG_KY_NAM_TRUOC', 'KY_LIEN_TRUOC', 'TUY_CHON', 'KHONG'])
  soSanh?: KieuSoSanh;

  /** Lũy kế từ đầu năm tới hết tháng này. Loại trừ với cặp `tu`/`den`. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  luyKeDenThang?: number;

  /** Khoảng tự chọn cho KỲ ĐANG XEM — phải đủ cả hai đầu. */
  @IsOptional()
  @IsDateString()
  tu?: string;

  @IsOptional()
  @IsDateString()
  den?: string;

  /** Khoảng tự chọn cho KỲ NỀN, dùng với `soSanh=TUY_CHON`. */
  @IsOptional()
  @IsDateString()
  nenTu?: string;

  @IsOptional()
  @IsDateString()
  nenDen?: string;
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
  district?: string; // Tên phường/xã (cải cách 2025: không còn cấp quận/huyện)
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
    return this.reportsService.getMonthly(year, query.month, query.soSanh, {
      luyKeDenThang: query.luyKeDenThang,
      tu: query.tu,
      den: query.den,
      nenTu: query.nenTu,
      nenDen: query.nenDen,
    });
  }

  // GET /api/v1/reports/quarterly?year=&quarter=
  @Get('quarterly')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  getQuarterly(@Query() query: QueryQuarterlyDto) {
    const year = query.year ?? new Date().getFullYear();
    return this.reportsService.getQuarterly(year, query.quarter, query.soSanh, {
      luyKeDenThang: query.luyKeDenThang,
      tu: query.tu,
      den: query.den,
      nenTu: query.nenTu,
      nenDen: query.nenDen,
    });
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
    if (query.format === EXPORT_FORMAT.EXCEL) {
      await this.reportsExportService.exportStat48(data as any, res);
    } else {
      res.json(data);
    }
  }
}
