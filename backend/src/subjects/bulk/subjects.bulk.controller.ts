import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkDeleteSubjectsDto } from '../dto/bulk-delete-subjects.dto';
import { BulkExportSubjectsDto } from '../dto/bulk-export-subjects.dto';
import { SubjectsBulkService } from './subjects.bulk.service';

@Controller('subjects')
export class SubjectsBulkController {
  constructor(private readonly bulkService: SubjectsBulkService) {}

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'delete', subject: 'Subject' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkDelete(
    @Body() dto: BulkDeleteSubjectsDto,
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

  // POST /api/v1/subjects/bulk-export — F5 — Xuất Excel nhiều đối tượng.
  // Read-only across SUSPECT/VICTIM/WITNESS (type column trong xlsx).
  @Post('bulk-export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'read', subject: 'Subject' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkExport(
    @Body() dto: BulkExportSubjectsDto,
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
