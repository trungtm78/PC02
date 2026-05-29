import { Module } from '@nestjs/common';
import { LawyersController } from './lawyers.controller';
import { LawyersService } from './lawyers.service';
import { LawyersBulkController } from './bulk/lawyers.bulk.controller';
import { LawyersBulkService } from './bulk/lawyers.bulk.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [LawyersController, LawyersBulkController],
  providers: [LawyersService, LawyersBulkService],
  exports: [LawyersService],
})
export class LawyersModule {}
