import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RecordReturnsController } from './record-returns.controller';
import { RecordReturnsService } from './record-returns.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [RecordReturnsController],
  providers: [RecordReturnsService],
  exports: [RecordReturnsService],
})
export class RecordReturnsModule {}
