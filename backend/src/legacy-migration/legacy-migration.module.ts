import { Module } from '@nestjs/common';
import { LegacyMigrationService } from './legacy-migration.service';
import { LegacyMigrationController } from './legacy-migration.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [LegacyMigrationService],
  controllers: [LegacyMigrationController],
  exports: [LegacyMigrationService],
})
export class LegacyMigrationModule {}
