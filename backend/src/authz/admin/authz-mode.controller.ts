import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { AuthzModeService } from './authz-mode.service';
import { ApproveEnforceDto, RequestEnforceDto, SetModeDto } from './dto';

const meta = (req: Request) => ({ ipAddress: req.ip, userAgent: req.headers['user-agent'] });

/**
 * Switching permissions by team on and off. Reading needs `read:Role`; changing needs `write:Role` AND being an
 * administrator (the service judges that from the database).
 *
 * Every step has its way back on the same resource: a request to enforce is withdrawn by who asked or rejected by
 * another administrator; enforcement is switched back to OFF (or SHADOW) by one administrator, at once.
 */
@Controller('authz/mode')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthzModeController {
  constructor(private readonly mode: AuthzModeService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Role' })
  status() {
    return this.mode.status();
  }

  /** Who gains and loses what if permissions by team were enforced now. */
  @Get('comparison')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  comparison() {
    return this.mode.comparison();
  }

  /** OFF or SHADOW, at once. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  set(@Body() body: SetModeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.mode.set(user.id, body.mode, body.reason, meta(req));
  }

  @Post('requests')
  @RequirePermissions({ action: 'write', subject: 'Role' })
  request(@Body() body: RequestEnforceDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.mode.requestEnforce(user.id, body.reason, body.acknowledge, meta(req));
  }

  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  approve(@Param('id') id: string, @Body() body: ApproveEnforceDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.mode.approve(id, user.id, body.acknowledge, meta(req));
  }

  /** Withdraw (by who asked) or reject (by another administrator). */
  @Post('requests/:id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'write', subject: 'Role' })
  close(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.mode.close(id, user.id, meta(req));
  }
}
