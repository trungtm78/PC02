import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { ChildRestoreController } from './child-restore.controller';
import { ChildRestoreService } from './child-restore.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ChildRestoreController],
  providers: [ChildRestoreService],
  exports: [ChildRestoreService],
})
export class ChildRestoreModule {}
