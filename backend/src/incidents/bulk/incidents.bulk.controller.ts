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
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { DispatchGuard } from '../../auth/guards/dispatch.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkAssignIncidentsDto } from '../dto/bulk-assign-incidents.dto';
import { BulkExportIncidentsDto } from '../dto/bulk-export-incidents.dto';
import { BulkDeleteIncidentsDto } from '../dto/bulk-delete-incidents.dto';
import { BulkRestoreIncidentsDto } from '../dto/bulk-restore-incidents.dto';
import { IncidentsBulkService } from './incidents.bulk.service';

@Controller('incidents')
export class IncidentsBulkController {
  constructor(private readonly bulkService: IncidentsBulkService) {}

  // POST /api/v1/incidents/bulk-assign — Phân công nhiều vụ việc (dispatcher only).
  @Post('bulk-assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, DispatchGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkAssign(
    @Body() dto: BulkAssignIncidentsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.bulkService.bulkAssign({
      ids: dto.ids,
      assignedTeamId: dto.assignedTeamId,
      investigatorId: dto.investigatorId,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
      actorId: user.id,
      dataScope: req.dataScope,
      meta: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }

  // POST /api/v1/incidents/bulk-delete — v0.50 PR3 soft delete N vụ việc.
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'delete', subject: 'Incident' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkDelete(
    @Body() dto: BulkDeleteIncidentsDto,
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

  // POST /api/v1/incidents/bulk-restore — v0.50 PR3 admin restore.
  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'restore', subject: 'Incident' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkRestore(
    @Body() dto: BulkRestoreIncidentsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.bulkService.bulkRestore({
      ids: dto.ids,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
      actorId: user.id,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }

  // POST /api/v1/incidents/bulk-export — Xuất Excel nhiều vụ việc (read-only).
  @Post('bulk-export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'read', subject: 'Incident' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkExport(
    @Body() dto: BulkExportIncidentsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.bulkService.bulkExport({
      ids: dto.ids,
      dataScope: req.dataScope,
      res,
      actorId: user.id,
      meta: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });
  }
}
