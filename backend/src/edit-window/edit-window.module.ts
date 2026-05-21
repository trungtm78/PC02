import { Module } from '@nestjs/common';
import { EditWindowService } from './edit-window.service';
import { EditWindowController } from './edit-window.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [AuditModule, SettingsModule, TeamsModule],
  providers: [EditWindowService],
  controllers: [EditWindowController],
  exports: [EditWindowService],
})
export class EditWindowModule {}
