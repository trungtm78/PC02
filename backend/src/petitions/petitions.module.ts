import { Module } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PetitionsController } from './petitions.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [PetitionsService],
  controllers: [PetitionsController],
  exports: [PetitionsService],
})
export class PetitionsModule {}
