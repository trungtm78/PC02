import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { BulkOperationsController } from './bulk-operations.controller';

@Module({
  providers: [AuditService],
  controllers: [AuditController, BulkOperationsController],
  exports: [AuditService],
})
export class AuditModule {}
