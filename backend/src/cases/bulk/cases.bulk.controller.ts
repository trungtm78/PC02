import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { DispatchGuard } from '../../auth/guards/dispatch.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkAssignCasesDto } from '../dto/bulk-assign-cases.dto';
import { BulkExportCasesDto } from '../dto/bulk-export-cases.dto';
import { BulkDeleteCasesDto } from '../dto/bulk-delete-cases.dto';
import { BulkRestoreCasesDto } from '../dto/bulk-restore-cases.dto';
import { CasesBulkService } from './cases.bulk.service';

/**
 * v0.48 PR1 B3a — Cases bulk-action endpoints.
 *
 * Gating (plan eng E-C4):
 * - JwtAuthGuard (auth).
 * - DispatchGuard cho bulk-assign (canDispatch || ADMIN). MATCH single-assign
 *   pattern ở cases.controller.ts:215 — KHÔNG widen authority qua @RequirePermissions edit.
 *
 * Rate limit (plan eng E-H6): @Throttle 5 req/min/user per endpoint, in-memory
 * single-replica acceptable per CLAUDE.md Deploy Configuration.
 *
 * HTTP 200 cho mọi response (kể cả mixed) — frontend phân loại theo result enum.
 * 207 Multi-Status defer ở PR2 nếu cần OpenAPI strict semantic.
 */
@Controller('cases')
export class CasesBulkController {
  constructor(private readonly bulkService: CasesBulkService) {}

  // POST /api/v1/cases/bulk-assign — Phân công nhiều vụ án về 1 tổ + điều tra viên.
  @Post('bulk-assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, DispatchGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkAssign(
    @Body() dto: BulkAssignCasesDto,
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

  // POST /api/v1/cases/bulk-delete — v0.49 PR2 soft-delete nhiều vụ án.
  // Per-item preflight enforce TIEP_NHAN + no-linked + creator-or-admin (match single-delete).
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'delete', subject: 'Case' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkDelete(
    @Body() dto: BulkDeleteCasesDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.bulkService.bulkDelete({
      ids: dto.ids,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
      actorId: user.id,
      actorRole: (user as any).role ?? '',
      dataScope: req.dataScope,
      meta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
  }

  // POST /api/v1/cases/bulk-restore — v0.49 PR2 khôi phục nhiều vụ án (ADMIN).
  @Post('bulk-restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkRestore(
    @Body() dto: BulkRestoreCasesDto,
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

  // POST /api/v1/cases/bulk-export — Xuất Excel nhiều vụ án theo lựa chọn.
  // Read-only: @RequirePermissions read (KHÔNG cần DispatchGuard).
  @Post('bulk-export')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions({ action: 'read', subject: 'Case' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async bulkExport(
    @Body() dto: BulkExportCasesDto,
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
