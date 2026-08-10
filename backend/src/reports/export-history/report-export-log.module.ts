import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReportExportLogService } from './report-export-log.service';
import { ReportExportLogController } from './report-export-log.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReportExportLogController],
  providers: [ReportExportLogService],
  exports: [ReportExportLogService],
})
export class ReportExportLogModule {}
