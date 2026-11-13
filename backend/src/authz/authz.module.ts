import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthzAdminController } from './admin/authz-admin.controller';
import { AuthzAdminService } from './admin/authz-admin.service';
import { AuthzController } from './authz.controller';
import { AuthzLookupService } from './authz-lookup.service';
import { AuthzScopeService } from './authz-scope.service';
import { AuthzService } from './authz.service';

/**
 * Permissions by team: the one module that owns the permission configuration and its engine.
 * Global because the route guard and the scope resolvers of every module ask `AuthzScopeService`.
 */
@Global()
@Module({
  imports: [AuditModule],
  controllers: [AuthzController, AuthzAdminController],
  providers: [AuthzService, AuthzScopeService, AuthzLookupService, AuthzAdminService],
  exports: [AuthzService, AuthzScopeService],
})
export class AuthzModule {}
