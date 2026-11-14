import { Controller, Get, NotFoundException, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
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
import { redactGrid, scopeTag } from './redact-grid';

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
    /** The assignment the entry screen opens the grid for: an editor's answer is scoped by it. */
    @Query('assignmentId') assignmentId?: unknown,
  ): Promise<GridModel | undefined> {
    // Authorise BEFORE touching the cache or the ETag: a caller outside the
    // report must not learn whether a version exists, nor get a 304 for it.
    const scope = await this.access.readScope(
      user.id,
      user.roleId,
      versionId,
      // Anything but one plain id (repeated, empty) is "no assignment named": the narrowest answer, not an error.
      typeof assignmentId === 'string' && assignmentId !== '' ? assignmentId : undefined,
    );
    if (scope.kind === 'NONE') throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');

    const whole = await this.grids.getForVersion(versionId);
    // An editor of a team that reports only some criteria gets the grid without the others, under a validator of its
    // own: the whole-report ETag must never earn a 304 for a narrower answer, nor the other way round.
    const { model, etag } =
      scope.kind === 'OWNED'
        ? {
            model: redactGrid(whole.model, scope.fields, scope.ownedFieldKeys, scope.criteriaRows),
            etag: `${whole.etag.replace(/"$/, '')}-o${scopeTag(scope.ownedFieldKeys)}"`,
          }
        : whole;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }
    return model;
  }
}
