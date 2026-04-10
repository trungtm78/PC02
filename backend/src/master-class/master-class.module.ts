import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MasterClassController } from './master-class.controller';
import { MasterClassService } from './master-class.service';

@Module({
  imports: [AuditModule],
  controllers: [MasterClassController],
  providers: [MasterClassService],
  exports: [MasterClassService],
})
export class MasterClassModule {}
