import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsController } from './petitions.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DeadlineRulesModule } from '../deadline-rules/deadline-rules.module';

@Module({
  imports: [AuditModule, SettingsModule, DeadlineRulesModule],
  providers: [PetitionsService],
  controllers: [PetitionsController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
