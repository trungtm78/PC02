import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthzLookupService } from './authz-lookup.service';
import { AuthzService } from './authz.service';

/**
 * Read-only for now: the catalogue the permission screens are drawn from, and "what may this person do, and why".
 * Gated by `read:Role`, the permission that already opens the role administration.
 */
@Controller('authz')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthzController {
  constructor(
    private readonly authz: AuthzService,
    private readonly lookup: AuthzLookupService,
  ) {}

  @Get('catalogue')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  async catalogue() {
    return { mode: await this.authz.mode(), resources: this.lookup.catalogue() };
  }

  @Get('effective/:userId')
  @RequirePermissions({ action: 'read', subject: 'Role' })
  effective(@Param('userId') userId: string) {
    return this.lookup.effectiveOf(userId);
  }
}
