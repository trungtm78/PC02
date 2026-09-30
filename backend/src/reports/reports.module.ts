import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PhuLuc16Module } from './phu-luc-1-6/phu-luc-1-6.module';
import { MonthlyReportPackageModule } from './monthly-package/monthly-report-package.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PhuLuc16Module,
    MonthlyReportPackageModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExportService],
  exports: [ReportsExportService],
})
export class ReportsModule {}
