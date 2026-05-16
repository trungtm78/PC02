import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuditModule } from '../audit/audit.module';
import { TeamsModule } from '../teams/teams.module';
import { AuthModule } from '../auth/auth.module';
import { BulkImportService } from './bulk/bulk-import.service';
import { BulkImportProcessor } from './bulk/bulk-import.processor';
import { EnrollmentPdfService } from './bulk/enrollment-pdf.service';
import {
  BulkImportController,
  BulkJobsController,
  BulkImportTemplateController,
} from './bulk/bulk-import.controller';

@Module({
  imports: [AuditModule, TeamsModule, forwardRef(() => AuthModule)],
  providers: [AdminService, BulkImportService, BulkImportProcessor, EnrollmentPdfService],
  controllers: [
    AdminController,
    BulkImportController,
    BulkJobsController,
    BulkImportTemplateController,
  ],
  exports: [AdminService],
})
export class AdminModule {}
