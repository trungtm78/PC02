import { Body, Controller, ForbiddenException, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { LegacyMigrationService } from './legacy-migration.service';
import { CommitMigrationDto, DryRunMigrationDto, RollbackMigrationDto } from './dto/migration.dto';

type ReqUser = { user?: { id?: string; role?: string } };

// Tool di trú dữ liệu hệ thống cũ — ADMIN/SUPER_ADMIN-only. dry-run đối soát → commit (idempotent) → rollback.
@Controller('legacy-migration')
@UseGuards(JwtAuthGuard)
export class LegacyMigrationController {
  constructor(private readonly svc: LegacyMigrationService) {}

  private assertAdmin(req: ReqUser): string {
    const role = req.user?.role;
    const id = req.user?.id;
    if (role !== ROLE_NAMES.ADMIN && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Chỉ ADMIN được thực hiện di trú dữ liệu');
    }
    if (!id) {
      throw new UnauthorizedException('Không xác định được người dùng');
    }
    return id;
  }

  @Post('dry-run')
  dryRun(@Body() body: DryRunMigrationDto, @Req() req: ReqUser) {
    this.assertAdmin(req);
    return this.svc.dryRun(body.records ?? []);
  }

  @Post('commit')
  commit(@Body() body: CommitMigrationDto, @Req() req: ReqUser) {
    const actorId = this.assertAdmin(req);
    return this.svc.commit(body.records ?? [], actorId);
  }

  @Post('rollback')
  rollback(@Body() body: RollbackMigrationDto, @Req() req: ReqUser) {
    const actorId = this.assertAdmin(req);
    return this.svc.rollback(body.legacyIds ?? [], actorId);
  }
}
