import { Module } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { IncidentsController } from './incidents.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, SettingsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
