import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsJourneyService } from './petitions-journey.service';
import { PetitionsController } from './petitions.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { DeadlineRulesModule } from '../deadline-rules/deadline-rules.module';

@Module({
  imports: [AuditModule, SettingsModule, DeadlineRulesModule],
  providers: [PetitionsService, PetitionsJourneyService],
  controllers: [PetitionsController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
