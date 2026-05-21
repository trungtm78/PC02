import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, SettingsModule], // v0.31.0.2: SettingsModule cho THOI_HAN_XOA_VU_AN
  providers: [CasesService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}
