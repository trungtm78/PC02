import { Controller, Get, NotFoundException, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { GridAccessService } from './grid-access.service';
import { GridModelService } from './grid-model.service';
import type { GridModel } from '../engine/grid-types';

interface AuthenticatedUser {
  id: string;
  roleId: string;
}

/**
 * The render-ready template grid of one report version. Read-only; the
 * client calls it once per version and revalidates with the ETag.
 */
@Controller('bao-cao-dong/versions')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class GridController {
  constructor(
    private readonly access: GridAccessService,
    private readonly grids: GridModelService,
  ) {}

  @Get(':versionId/grid')
  @RequirePermissions({ action: 'read', subject: 'DynamicReport' })
  async grid(
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GridModel | undefined> {
    // Authorise BEFORE touching the cache or the ETag: a caller outside the
    // report must not learn whether a version exists, nor get a 304 for it.
    const allowed = await this.access.canReadVersion(user.id, user.roleId, versionId);
    if (!allowed) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');

    const { model, etag } = await this.grids.getForVersion(versionId);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return model;
  }
}
