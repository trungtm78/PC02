import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsController } from './petitions.controller';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AuditModule, SettingsModule],
  providers: [PetitionsService],
  controllers: [PetitionsController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
