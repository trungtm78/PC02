import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { AuditModule } from '../audit/audit.module';
import { IsWardDirectoryConstraint } from '../common/validators/is-ward-directory.validator';

@Module({
  imports: [AuditModule],
  providers: [TeamsService, IsWardDirectoryConstraint], // v0.33: register class-validator constraint
  controllers: [TeamsController],
  exports: [TeamsService],
})
export class TeamsModule {}
