import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { TeamLifecycleService } from './team-lifecycle.service';
import { AuditModule } from '../audit/audit.module';
import { IsWardDirectoryConstraint } from '../common/validators/is-ward-directory.validator';

@Module({
  imports: [AuditModule],
  providers: [TeamsService, TeamLifecycleService, IsWardDirectoryConstraint], // v0.33: register class-validator constraint
  controllers: [TeamsController],
  exports: [TeamsService, TeamLifecycleService],
})
export class TeamsModule {}
