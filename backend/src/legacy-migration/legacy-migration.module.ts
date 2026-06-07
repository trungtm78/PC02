import { Module } from '@nestjs/common';
import { LegacyMigrationService } from './legacy-migration.service';
import { LegacyMigrationController } from './legacy-migration.controller';

@Module({
  providers: [LegacyMigrationService],
  controllers: [LegacyMigrationController],
  exports: [LegacyMigrationService],
})
export class LegacyMigrationModule {}
