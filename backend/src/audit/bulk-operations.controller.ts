import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from './audit.service';

/**
 * D9 — đọc lịch sử thao tác hàng loạt.
 *
 * Controller riêng chứ không nối thêm vào `/audit-logs`: nhật ký kiểm toán là
 * một dòng cho mỗi hồ sơ, còn đây là một dòng cho mỗi MẺ. Gộp hai hình dạng vào
 * cùng một endpoint buộc màn hình phải đoán nó đang đọc loại nào.
 */
@Controller('bulk-operations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BulkOperationsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  list(
    @Query()
    query: {
      resource?: string;
      action?: string;
      actorId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    return this.auditService.listBulkOperations(query);
  }

  @Get(':id')
  @RequirePermissions({ action: 'read', subject: 'AuditLog' })
  getOne(@Param('id') id: string) {
    return this.auditService.getBulkOperationById(id);
  }
}
