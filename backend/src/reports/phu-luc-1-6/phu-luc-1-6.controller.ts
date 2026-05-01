import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
  ) {}

  /**
   * GET /api/v1/reports/phu-luc-1-6/preview?loai=1&fromDate=&toDate=&unit=
   *
   * Returns JSON preview data: { total, data, limited }
   */
  @Get('preview')
  @RequirePermissions({ action: 'read', subject: 'Case' })
  async preview(
    @Query() query: PhuLuc16QueryDto,
    @Req() _req: ScopedRequest,
  ) {
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
    @Req() _req: ScopedRequest,
    @Res() res: Response,
  ) {
    const result = await this.phuLuc16Service.getForLoai(query.loai, {
      loai: query.loai,
      fromDate: query.fromDate,
      toDate: query.toDate,
      unit: query.unit,
    });

    await this.phuLuc16ExportService.export(query.loai, result.data, res);
  }
}
