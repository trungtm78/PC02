import { Module } from '@nestjs/common';
import { AdminUnitsService } from './admin-units.service';
import { AdminUnitsController } from './admin-units.controller';

@Module({
  providers: [AdminUnitsService],
  controllers: [AdminUnitsController],
  exports: [AdminUnitsService],
})
export class AdminUnitsModule {}
