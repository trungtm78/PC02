import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { LegacyMigrationService } from './legacy-migration.service';
import type { LegacyRecord } from './legacy-mapper';

type ReqUser = { user?: { id?: string; role?: string } };

// Tool di trú dữ liệu hệ thống cũ — ADMIN-only. dry-run đối soát → commit (idempotent) → rollback.
@Controller('legacy-migration')
@UseGuards(JwtAuthGuard)
export class LegacyMigrationController {
  constructor(private readonly svc: LegacyMigrationService) {}

  private assertAdmin(req: ReqUser): string {
    if (req.user?.role !== ROLE_NAMES.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN được thực hiện di trú dữ liệu');
    }
    return req.user?.id ?? 'system';
  }

  @Post('dry-run')
  dryRun(@Body() body: { records: LegacyRecord[] }, @Req() req: ReqUser) {
    this.assertAdmin(req);
    return this.svc.dryRun(body.records ?? []);
  }

  @Post('commit')
  commit(@Body() body: { records: LegacyRecord[] }, @Req() req: ReqUser) {
    const actorId = this.assertAdmin(req);
    return this.svc.commit(body.records ?? [], actorId);
  }

  @Post('rollback')
  rollback(@Body() body: { legacyIds: string[] }, @Req() req: ReqUser) {
    const actorId = this.assertAdmin(req);
    return this.svc.rollback(body.legacyIds ?? [], actorId);
  }
}
