import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogValue } from './catalog.registry';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

// Cung cấp options danh mục cho FE (chủ yếu nhóm dynamic; legal FE đã có inline qua generated).
// Auth KHÔNG global trong dự án → bắt buộc khai báo guard như directory.controller (đọc Directory).
@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':key/options')
  @RequirePermissions({ action: 'read', subject: 'Directory' })
  options(@Param('key') key: string): Promise<CatalogValue[]> {
    return this.catalog.options(key);
  }
}
