import { Module } from '@nestjs/common';
import { AuthzController } from './authz.controller';
import { AuthzLookupService } from './authz-lookup.service';
import { AuthzService } from './authz.service';

/** Permissions by team: the one module that owns the permission configuration and its engine. */
@Module({
  controllers: [AuthzController],
  providers: [AuthzService, AuthzLookupService],
  exports: [AuthzService],
})
export class AuthzModule {}
