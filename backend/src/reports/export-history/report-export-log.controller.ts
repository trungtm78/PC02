import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { ReportExportLogService } from './report-export-log.service';

/**
 * D7/D8 — lịch sử xuất báo cáo.
 *
 * `read:AuditLog` chứ không phải `read:Case`: đây là câu hỏi "ai đã lấy dữ liệu
 * ra khỏi hệ thống", cùng loại với nhật ký hoạt động, không phải câu hỏi nghiệp
 * vụ về hồ sơ.
 */
@Controller('reports/export-history')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportExportLogController {
  constructor(private readonly service: ReportExportLogService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  list(
    @Query()
    query: {
      reportType?: string;
      exportedById?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  getOne(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
