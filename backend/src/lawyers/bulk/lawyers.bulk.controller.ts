import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkDeleteLawyersDto } from '../dto/bulk-delete-lawyers.dto';
import { BulkExportLawyersDto } from '../dto/bulk-export-lawyers.dto';
import { LawyersBulkService } from './lawyers.bulk.service';

@Controller('lawyers')
export class LawyersBulkController {
  constructor(private readonly bulkService: LawyersBulkService) {}

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'delete', subject: 'Lawyer' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkDelete(
    @Body() dto: BulkDeleteLawyersDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.bulkService.bulkDelete({
      ids: dto.ids,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
      actorId: user.id,
      dataScope: req.dataScope,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }

  // POST /api/v1/lawyers/bulk-export — F5 — Xuất Excel nhiều luật sư.
  // Read-only: 'read' permission, không cần delete.
  @Post('bulk-export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'read', subject: 'Lawyer' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkExport(
    @Body() dto: BulkExportLawyersDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.bulkService.bulkExport({
      ids: dto.ids,
      dataScope: req.dataScope,
      res,
      actorId: user.id,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }
}
