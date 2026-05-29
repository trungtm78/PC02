import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DispatchGuard } from '../../auth/guards/dispatch.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkAssignCasesDto } from '../dto/bulk-assign-cases.dto';
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
}
