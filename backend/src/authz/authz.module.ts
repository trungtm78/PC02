import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthzAdminController } from './admin/authz-admin.controller';
import { AuthzAdminService } from './admin/authz-admin.service';
import { AuthzController } from './authz.controller';
import { AuthzLookupService } from './authz-lookup.service';
import { AuthzService } from './authz.service';

/** Permissions by team: the one module that owns the permission configuration and its engine. */
@Module({
  imports: [AuditModule],
  controllers: [AuthzController, AuthzAdminController],
  providers: [AuthzService, AuthzLookupService, AuthzAdminService],
  exports: [AuthzService],
})
export class AuthzModule {}
