import { CaseGraphAccessModule } from '../graph-access/case-graph-access.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MonthlyReportBuilderService } from './monthly-report-builder.service';
import { MonthlyReportExportService } from './monthly-report-export.service';
import { MonthlyReportPackageController } from './monthly-report-package.controller';
import { MonthlyReportPackageService } from './monthly-report-package.service';

@Module({
  imports: [CaseGraphAccessModule, PrismaModule, AuthModule, AuditModule],
  controllers: [MonthlyReportPackageController],
  providers: [
    MonthlyReportBuilderService,
    MonthlyReportExportService,
    MonthlyReportPackageService,
  ],
  exports: [MonthlyReportPackageService],
})
export class MonthlyReportPackageModule {}
