import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminUnitsService } from './admin-units.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Admin Units API — read-only browser (v0.34.0.0).
 *
 * No @RequirePermissions: all authenticated users can read admin units
 * (needed by SingleWardPicker in TeamsPage, future Case/Subject forms, etc.).
 * v0.34b will add ADMIN-gated abolish queue endpoints.
 */
@Controller('admin-units')
@UseGuards(JwtAuthGuard)
export class AdminUnitsController {
  constructor(private readonly service: AdminUnitsService) {}

  /** GET /admin-units/provinces — all 34 active provinces */
  @Get('provinces')
  getProvinces() {
    return this.service.getProvinces();
  }

  /** GET /admin-units/wards?provinceId=xxx&q=search */
  @Get('wards')
  getWards(@Query('provinceId') provinceId: string, @Query('q') q?: string) {
    return this.service.getWardsByProvince(provinceId, q);
  }

  /**
   * GET /admin-units/wards/:id — single ward + province metadata.
   * Used by SingleWardPicker reverse lookup (Phase 2 D3 fix).
   */
  @Get('wards/:id')
  getWardById(@Param('id') id: string) {
    return this.service.getWardById(id);
  }

  /** GET /admin-units/search?q=xxx — global Cmd+K search, top 50 grouped */
  @Get('search')
  search(@Query('q') q: string) {
    return this.service.searchWards(q ?? '');
  }

  /** GET /admin-units/dataset — current active dataset metadata */
  @Get('dataset')
  getDataset() {
    return this.service.getCurrentDatasetVersion();
  }
}
