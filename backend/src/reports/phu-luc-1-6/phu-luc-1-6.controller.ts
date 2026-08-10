import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  IsInt,
  IsOptional,
  IsDateString,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { PhuLuc16Service } from './phu-luc-1-6.service';
import { PhuLuc16ExportService } from './phu-luc-1-6-export.service';
import { ReportExportLogService } from '../export-history/report-export-log.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';

// ─────────────────────────────────────────────────────────────────────────────
// DTO
// ─────────────────────────────────────────────────────────────────────────────

class PhuLuc16QueryDto {
  @IsInt()
  @Min(1)
  @Max(6)
  @Type(() => Number)
  loai!: number;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  unit?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

@Controller('reports/phu-luc-1-6')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PhuLuc16Controller {
  constructor(
    private readonly phuLuc16Service: PhuLuc16Service,
    private readonly phuLuc16ExportService: PhuLuc16ExportService,
    private readonly exportLog: ReportExportLogService,
  ) {}

  /**
   * GET /api/v1/reports/phu-luc-1-6/preview?loai=1&fromDate=&toDate=&unit=
   *
   * Returns JSON preview data: { total, data, limited }
   */
  @Get('preview')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async preview(@Query() query: PhuLuc16QueryDto, @Req() _req: ScopedRequest) {
    return this.phuLuc16Service.getForLoai(query.loai, {
      loai: query.loai,
      fromDate: query.fromDate,
      toDate: query.toDate,
      unit: query.unit,
    });
  }

  /**
   * GET /api/v1/reports/phu-luc-1-6/export?loai=1&fromDate=&toDate=&unit=
   *
   * Streams an Excel (.xlsx) file for the requested Phụ lục type.
   * Rate-limited to 3 requests per minute.
   */
  @Get('export')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async export(
    @Query() query: PhuLuc16QueryDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ) {
    const result = await this.phuLuc16Service.getForLoai(query.loai, {
      loai: query.loai,
      fromDate: query.fromDate,
      toDate: query.toDate,
      unit: query.unit,
    });

    // D7 — `@Req() _req` từng bị bỏ không: không ai biết ai đã xuất bản nào.
    // Với số liệu tố tụng, "ai đang cầm bản này" là câu hỏi có thật.
    const fileName = `PhuLuc${query.loai}_PC02_${Date.now()}.xlsx`;
    const logEntry = {
      reportType: `PHU_LUC_${query.loai}`,
      fileName,
      rowCount: result.data.length,
      periodStart: query.fromDate ? new Date(query.fromDate) : null,
      periodEnd: query.toDate ? new Date(query.toDate) : null,
      exportedById: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    try {
      await this.phuLuc16ExportService.export(query.loai, result.data, res);
    } catch (err) {
      // Hỏng giữa chừng vẫn là một lần dữ liệu rời hệ thống một phần — phải
      // phân biệt được với một lần xuất trọn vẹn.
      await this.exportLog.record({
        ...logEntry,
        succeeded: false,
        errorText: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
      });
      throw err;
    }

    await this.exportLog.record(logEntry);
  }
}
