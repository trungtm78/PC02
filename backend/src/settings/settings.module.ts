import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { GiaoDienController } from './giao-dien.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [SettingsService],
  controllers: [SettingsController, GiaoDienController],
  exports: [SettingsService],
})
export class SettingsModule {}
