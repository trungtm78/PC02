import { Module } from '@nestjs/common';
import { UserExportPreferencesController } from './user-export-preferences.controller';
import { UserExportPreferencesService } from './user-export-preferences.service';

@Module({
  controllers: [UserExportPreferencesController],
  providers: [UserExportPreferencesService],
  exports: [UserExportPreferencesService],
})
export class UserExportPreferencesModule {}
