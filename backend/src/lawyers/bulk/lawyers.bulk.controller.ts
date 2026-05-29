import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { BulkDeleteLawyersDto } from '../dto/bulk-delete-lawyers.dto';
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
}
