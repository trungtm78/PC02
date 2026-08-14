import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import type { ScopedRequest } from '../../auth/interfaces/scoped-request.interface';
import { ChildRestoreService } from './child-restore.service';
import { RestoreChildDto } from './dto/restore-child.dto';

/**
 * E3 — khôi phục hồ sơ con đã xoá mềm.
 *
 * `restore:Case` cho mọi loại: seed chỉ cấp quyền này cho ADMIN, và ba loại
 * không có hồ sơ cha (hướng dẫn, trao đổi, lịch công tác) không có phạm vi tổ
 * nào để chặn — quyền là lớp chặn duy nhất còn lại cho chúng.
 */
@Controller('admin/restore')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChildRestoreController {
  constructor(private readonly service: ChildRestoreService) {}

  @Get()
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  listTargets() {
    return this.service.listTargets();
  }

  @Get(':resource')
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  listDeleted(
    @Param('resource') resource: string,
    @Query() query: { limit?: number; offset?: number; search?: string },
    @Req() req: ScopedRequest,
  ) {
    return this.service.listDeleted(resource, query, req.dataScope);
  }

  @Post(':resource/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'restore', subject: 'Case' })
  restore(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: RestoreChildDto,
    @CurrentUser() user: AuthUser,
    @Req() req: ScopedRequest,
  ) {
    return this.service.restore(
      resource,
      id,
      dto.reason,
      user.id,
      req.dataScope,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }
}
